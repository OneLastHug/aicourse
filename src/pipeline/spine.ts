import type { ZhOutline, ProgressEvent, Repo2LearnConfig, RepoContext, SpineArtifact } from "../types";
import { spinePrompt } from "../prompts/spine";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { configFingerprint } from "../config";
import { codexJson } from "./_call";
import { isSpineArtifact } from "../codex/guards";
import { flatZhLessons } from "./curriculum";
import { log } from "../util/log";

/** Spine stage — materialize a runnable teaching-code snapshot per lesson, where
 *  each snapshot is a SUPERSET of the previous one (one mechanism added at a time,
 *  learn.shareai.run's sNN/code style). Runs SEQUENTIALLY (each prompt carries the
 *  previous lesson's full code) — unlike the concurrent lesson stage.
 *
 *  Degradation: a single lesson failing is non-fatal — its spine is simply left
 *  out (lessonWrite then falls back to teaching the real source), and `prev` stays
 *  at the last successful snapshot so later lessons keep growing from there. */
export async function runSpineStage(args: {
  ctx: RepoContext; outline: ZhOutline; analysis: string; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<Record<string, SpineArtifact>> {
  const { ctx, outline, analysis, driver, cfg, cache, onProgress } = args;
  const flat = flatZhLessons(outline);
  const fp = configFingerprint(cfg);
  const acc: Record<string, SpineArtifact> = {};
  let prev: SpineArtifact | undefined;
  log.stage(`Spine · ${flat.length} runnable snapshots (sequential)`);
  for (const l of flat) {
    // prevHash (the previous snapshot's code) is part of the key so regenerating an
    // earlier lesson correctly cascades-invalidates every later snapshot.
    const key = cache.key({ stage: "spine", sha: ctx.sha, id: l.id, prev: prev ? prev.code : "none", cfg: fp, v: 1 });
    let art = await cache.get<SpineArtifact>(key);
    if (!art) {
      onProgress?.({ type: "spine", id: l.id, status: "start" });
      try {
        art = await codexJson<SpineArtifact>({
          driver, label: `spine:${l.id}`, cwd: ctx.localPath, guard: isSpineArtifact, name: `spine ${l.id}`,
          prompt: spinePrompt(ctx, l, prev, analysis),
        });
        art.lessonId = l.id; // trust our id over the model's
        await cache.set(key, art);
      } catch (e) {
        log.warn(`spine ${l.id} failed (lesson falls back to real source): ${(e as Error).message}`);
        onProgress?.({ type: "spine", id: l.id, status: "failed", label: (e as Error).message });
        continue; // leave acc[l.id] absent; prev unchanged
      }
    }
    acc[l.id] = art;
    prev = art;
    onProgress?.({ type: "spine", id: l.id, status: "ok" });
  }
  return acc;
}
