import { resolveConfig } from "repo2learn/src/config";
import { CliCodexDriver } from "repo2learn/src/codex/cli-driver";
import { MockCodexDriver } from "repo2learn/src/codex/mock-driver";
import { sampleResponder } from "repo2learn/src/sample/responder";
import { runPipeline } from "repo2learn/src/pipeline/run";
import type { Course, ProgressEvent } from "repo2learn/src/types";
import { WORK_DIR, CACHE_DIR } from "./store";

const MOCK = process.env.R2L_MOCK === "1";

/** Full v2 pipeline, server-side. Mock mode uses canned data (no codex, no clone). */
export async function generateCourse(args: {
  repoUrl: string;
  onProgress: (e: ProgressEvent) => void;
}): Promise<Course> {
  const { repoUrl, onProgress } = args;
  const cfg = resolveConfig({});
  cfg.workDir = WORK_DIR;
  cfg.cacheDir = CACHE_DIR;
  cfg.noCache = false;
  cfg.repo = repoUrl;
  cfg.useMock = MOCK;
  const driver = MOCK
    ? new MockCodexDriver({ responder: sampleResponder, delayMs: 300 })
    : new CliCodexDriver(cfg.codex);
  return runPipeline({ cfg, driver, onProgress });
}
