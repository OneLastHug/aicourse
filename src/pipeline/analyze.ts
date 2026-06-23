import type { ProgressEvent, Repo2LearnConfig, RepoContext } from "../types";
import { analyzePrompt } from "../prompts/analyze";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { configFingerprint } from "../config";

export async function runAnalyzeStage(args: {
  ctx: RepoContext; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<string> {
  const { ctx, driver, cfg, cache, onProgress } = args;
  const key = cache.key({ stage: "analyze", sha: ctx.sha, cfg: configFingerprint(cfg), v: 2 });
  const cached = await cache.get<string>(key);
  if (cached) { onProgress?.({ type: "log", level: "info", message: "analyze: cache hit" }); return cached; }
  onProgress?.({ type: "log", level: "info", message: "analyze: opening source files..." });
  onProgress?.({ type: "log", level: "info", message: "analyze: codex reading " + ctx.tree.length + " files..." });
  const res = await driver.run({ label: "analyze", prompt: analyzePrompt(ctx), cwd: ctx.localPath });
  onProgress?.({ type: "log", level: "info", message: "analyze: done (" + res.durationMs + "ms)" });
  await cache.set(key, res.text);
  return res.text;
}
