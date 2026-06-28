import type { ZhOutline, ProgressEvent, Repo2LearnConfig, RepoContext } from "../types";
import { curriculumPrompt } from "../prompts/curriculum";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { configFingerprint } from "../config";
import { codexJson } from "./_call";
import { isZhOutline } from "../codex/guards";

export async function runCurriculumStage(args: {
  ctx: RepoContext; analysis: string; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<ZhOutline> {
  const { ctx, analysis, driver, cfg, cache, onProgress } = args;
  const key = cache.key({ stage: "curriculum", sha: ctx.sha, cfg: configFingerprint(cfg), v: 5 });
  const cached = await cache.get<ZhOutline>(key);
  if (cached) { onProgress?.({ type: "log", level: "info", message: "curriculum cache hit" }); return cached; }
  const outline = await codexJson({
    driver, label: "curriculum", cwd: ctx.localPath, guard: isZhOutline, name: "curriculum",
    prompt: curriculumPrompt(ctx, analysis, cfg.targetLessonCount),
  });
  normalizeZh(outline);
  await cache.set(key, outline);
  return outline;
}

function normalizeZh(o: ZhOutline): void {
  let n = 0;
  o.sections.forEach((s, si) => {
    s.id = `l${String(si + 1).padStart(2, "0")}`;
    s.lessons.forEach((l) => {
      n += 1; l.id = `s${String(n).padStart(2, "0")}`;
      l.prereq = (l.prereq ?? []).filter((p) => true);
      l.tags = l.tags ?? []; l.filesToRead = l.filesToRead ?? [];
    });
  });
}

export function flatZhLessons(o: ZhOutline) { return (o?.sections ?? []).flatMap((s) => s?.lessons ?? []); }
