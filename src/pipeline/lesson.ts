import type { EnLesson, EnOutline, EnOutlineLesson, ProgressEvent, Repo2LearnConfig, RepoContext } from "../types";
import { lessonReadPrompt } from "../prompts/lessonRead";
import { lessonWritePrompt } from "../prompts/lessonWrite";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { createLimiter } from "../util/concurrency";
import { configFingerprint } from "../config";
import { codexJson } from "./_call";
import { isEnLesson } from "../codex/guards";
import { flatEnLessons } from "./curriculum";
import { log } from "../util/log";

export async function runLessonStages(args: {
  ctx: RepoContext; outline: EnOutline; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<Record<string, EnLesson>> {
  const { ctx, outline, driver, cfg, cache, onProgress } = args;
  const flat = flatEnLessons(outline);
  const titles = flat.map((l) => `${l.id} ${l.title} (${l.difficulty})`).join("\n");
  const limit = createLimiter(cfg.codex.concurrency);
  log.stage(`Stage 3 · ${flat.length} lessons (2-phase, concurrency ${cfg.codex.concurrency})`);
  const entries = await Promise.all(flat.map((l) => limit(() => genLesson({ l, ctx, titles, driver, cfg, cache, onProgress }))));
  return Object.fromEntries(entries);
}

async function genLesson(args: {
  l: EnOutlineLesson; ctx: RepoContext; titles: string; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<[string, EnLesson]> {
  const { l, ctx, titles, driver, cfg, cache, onProgress } = args;
  const key = cache.key({ stage: "lesson", sha: ctx.sha, id: l.id, cfg: configFingerprint(cfg), v: 2 });
  const cached = await cache.get<EnLesson>(key);
  if (cached) { onProgress?.({ type: "lesson", id: l.id, status: "ok", label: "cache hit" }); return [l.id, cached]; }
  onProgress?.({ type: "lesson", id: l.id, status: "start" });
  // 3a READ — free-form JSON text (mechanism understanding); keep raw.
  const readRes = await driver.run({ label: `lesson:read:${l.id}`, prompt: lessonReadPrompt(ctx, l, titles), cwd: ctx.localPath });
  // 3b WRITE — strict EnLesson JSON.
  const en = await codexJson({
    driver, label: `lesson:write:${l.id}`, cwd: ctx.localPath, guard: isEnLesson, name: `lesson ${l.id}`,
    prompt: lessonWritePrompt(l, readRes.text),
  });
  await cache.set(key, en);
  onProgress?.({ type: "lesson", id: l.id, status: "ok" });
  return [l.id, en];
}
