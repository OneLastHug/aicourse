import type { Outline, ProgressEvent, Repo2LearnConfig, RepoContext } from "../types";
import { architectPrompt } from "../prompts/architect";
import type { CodexDriver } from "../codex/driver";
import { assertShape, extractJson } from "../codex/parse";
import { isOutline } from "../codex/guards";
import { Cache } from "../util/cache";
import { configFingerprint } from "../config";
import { log } from "../util/log";

/** Stage 1 — one deep codex call to produce the layered outline (s01..sN). */
export async function runOutlineStage(args: {
  ctx: RepoContext;
  driver: CodexDriver;
  cfg: Repo2LearnConfig;
  cache: Cache;
  onProgress?: (e: ProgressEvent) => void;
}): Promise<Outline> {
  const { ctx, driver, cfg, cache, onProgress } = args;
  const key = cache.key({
    stage: "outline",
    sha: ctx.sha,
    name: ctx.name,
    cfg: configFingerprint(cfg),
    promptVersion: 2,
  });

  const cached = await cache.get<Outline>(key);
  if (cached) {
    log.ok(`outline: cache hit (${cached.lessons.length} lessons)`);
    onProgress?.({ type: "log", level: "info", message: `outline cache hit (${cached.lessons.length} lessons)` });
    return cached;
  }

  onProgress?.({ type: "log", level: "info", message: `architect · model=${cfg.codex.model} effort=${cfg.codex.reasoningEffort}` });
  const prompt = architectPrompt(ctx, cfg.targetLessonCount);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await driver.run({ label: "outline", prompt, cwd: ctx.localPath });
      const parsed = extractJson<unknown>(res.text);
      const outline = assertShape(parsed, isOutline, "outline");
      normalize(outline);
      await cache.set(key, outline);
      log.ok(`outline: ${outline.lessons.length} lessons parsed (attempt ${attempt}, ${res.durationMs}ms)`);
      return outline;
    } catch (e) {
      lastErr = e;
      log.warn(`outline attempt ${attempt} failed: ${(e as Error).message}`);
      onProgress?.({ type: "log", level: "warn", message: `outline attempt ${attempt} failed: ${(e as Error).message}` });
    }
  }
  throw new Error(`outline stage failed: ${(lastErr as Error).message}`);
}

/** Defensive normalization: re-pad ids, drop dangling prereqs. */
function normalize(o: Outline): void {
  o.lessons.forEach((l, i) => {
    l.id = `s${String(i + 1).padStart(2, "0")}`;
    l.prereq = (l.prereq ?? []).filter(
      (p) => p !== l.id && o.lessons.some((x) => x.id === p),
    );
    l.keyFiles = l.keyFiles ?? [];
    l.tags = l.tags ?? [];
  });
}
