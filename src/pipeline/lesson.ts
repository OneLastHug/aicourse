import type { ZhLesson, ZhOutline, ZhOutlineLesson, ProgressEvent, Repo2LearnConfig, RepoContext, SpineArtifact } from "../types";
import { lessonReadPrompt } from "../prompts/lessonRead";
import { lessonWritePrompt } from "../prompts/lessonWrite";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { getGlobalLimiter } from "../util/concurrency";
import { configFingerprint } from "../config";
import { codexJson } from "./_call";
import { isZhLesson } from "../codex/guards";
import { flatZhLessons } from "./curriculum";
import { log } from "../util/log";

export async function runLessonStages(args: {
  ctx: RepoContext; outline: ZhOutline; spine?: Record<string, SpineArtifact>; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<Record<string, ZhLesson>> {
  const { ctx, outline, spine = {}, driver, cfg, cache, onProgress } = args;
  const flat = flatZhLessons(outline);
  const titles = flat.map((l) => `${l.id} ${l.title} (${l.difficulty})`).join("\n");
  const limit = getGlobalLimiter(cfg.codex.concurrency);
  log.stage(`Stage 3 · ${flat.length} lessons (2-phase, concurrency ${cfg.codex.concurrency})`);
  const entries = await Promise.all(flat.map((l) => limit(() => genLesson({ l, ctx, titles, spine: spine[l.id], driver, cfg, cache, onProgress }))));
  return Object.fromEntries(entries);
}

async function genLesson(args: {
  l: ZhOutlineLesson; ctx: RepoContext; titles: string; spine?: SpineArtifact; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<[string, ZhLesson]> {
  const { l, ctx, titles, spine, driver, cfg, cache, onProgress } = args;
  // v3: lessonWrite now consumes the spine snapshot + emits principle/diagram/badges
  // + a "compare with real source" step. The cache key includes the spine code so a
  // changed spine re-triggers the write.
  const key = cache.key({ stage: "lesson", sha: ctx.sha, id: l.id, spine: spine ? spine.code : "none", cfg: configFingerprint(cfg), v: 6 });
  const cached = await cache.get<ZhLesson>(key);
  if (cached) { onProgress?.({ type: "lesson", id: l.id, status: "ok", label: "cache hit" }); return [l.id, cached]; }
  onProgress?.({ type: "lesson", id: l.id, status: "start" });
  // 3a READ — free-form JSON text (mechanism understanding); keep raw.
  const readRes = await driver.run({ label: `lesson:read:${l.id}`, prompt: lessonReadPrompt(ctx, l, titles), cwd: ctx.localPath });
  // 3b WRITE — strict ZhLesson JSON.
  const zh = await codexJson({
    driver, label: `lesson:write:${l.id}`, cwd: ctx.localPath, guard: isZhLesson, name: `lesson ${l.id}`,
    prompt: lessonWritePrompt(l, readRes.text, spine),
  });
  await cache.set(key, zh);
  onProgress?.({ type: "lessonDraft", id: l.id, body: zh });
  onProgress?.({ type: "lesson", id: l.id, status: "ok" });
  return [l.id, zh];
}
