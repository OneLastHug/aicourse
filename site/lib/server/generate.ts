import { rm } from "node:fs/promises";
import { resolveConfig } from "repo2learn/src/config";
import { CliCodexDriver } from "repo2learn/src/codex/cli-driver";
import { MockCodexDriver } from "repo2learn/src/codex/mock-driver";
import { sampleResponder } from "repo2learn/src/sample/responder";
import { ingestRepo } from "repo2learn/src/util/repo";
import { runOutlineStage } from "repo2learn/src/pipeline/outline";
import { runContentStage, assembleCourse } from "repo2learn/src/pipeline/content";
import { Cache } from "repo2learn/src/util/cache";
import type { Course, ProgressEvent, RepoContext } from "repo2learn/src/types";
import { WORK_DIR, CACHE_DIR } from "./store";

const MOCK = process.env.R2L_MOCK === "1";

function syntheticCtx(): RepoContext {
  return {
    url: "local://nano-agent", localPath: "", sha: "sample", name: "nano-agent",
    defaultBranch: "main",
    summary: { zh: "一个迷你的类 Claude Code 编程 agent。", en: "A tiny Claude-Code-like coding agent." },
    loc: 57, languages: { TypeScript: 0.9, Markdown: 0.1 },
    tree: ["src/index.ts","src/loop.ts","src/tools.ts","src/model.ts","src/prompt.ts","README.md","package.json"],
    keyFiles: [],
  };
}

/**
 * Full pipeline, server-side, per submitted repo. On ANY failure it deletes the
 * cloned repo so the system is left clean (no residuals), then rethrows.
 */
export async function generateCourse(args: {
  repoUrl: string;
  onProgress: (e: ProgressEvent) => void;
}): Promise<Course> {
  const { repoUrl, onProgress } = args;
  const cfg = resolveConfig({});
  cfg.workDir = WORK_DIR;
  cfg.cacheDir = CACHE_DIR;
  cfg.noCache = false;
  const cache = Cache.fromConfig(cfg);

  const driver = MOCK
    ? new MockCodexDriver({ responder: sampleResponder, delayMs: 500 })
    : new CliCodexDriver(cfg.codex);

  let ctx: RepoContext | undefined;
  try {
    onProgress({ type: "stage", stage: "ingest", label: MOCK ? "Scanning sample repo" : "Cloning & scanning repo" });
    ctx = MOCK ? syntheticCtx() : await ingestRepo(repoUrl, cfg.workDir);

    onProgress({ type: "stage", stage: "outline", label: `Architect · layered outline · ${cfg.codex.model}/${cfg.codex.reasoningEffort}` });
    const outline = await runOutlineStage({ ctx, driver, cfg, cache, onProgress });

    onProgress({
      type: "plan",
      total: outline.lessons.length,
      lessons: outline.lessons.map((l) => ({ id: l.id, title: l.title, difficulty: l.difficulty })),
    });
    onProgress({ type: "stage", stage: "content", label: `Filling ${outline.lessons.length} lessons · concurrency ${cfg.codex.concurrency}` });
    const lessons = await runContentStage({ ctx, outline, driver, cfg, cache, onProgress });

    const course = assembleCourse(outline, lessons);
    onProgress({ type: "stage", stage: "done", label: "Done" });
    return course;
  } catch (e) {
    // Clean up the pulled repo + residuals so it's as if generation never happened.
    if (!MOCK && ctx?.localPath) {
      await rm(ctx.localPath, { recursive: true, force: true }).catch(() => {});
    }
    throw e;
  }
}
