#!/usr/bin/env node
/**
 * Repo2Learn CLI — turn a repository into a layered bilingual tutorial site.
 *
 * Usage:
 *   repo2learn <repo-url-or-path>           # real run via codex (gpt-5.5 / xhigh)
 *   repo2learn --sample                     # offline demo with the mock driver
 *   repo2learn <repo> --no-cache            # force recompute
 *   repo2learn <repo> --concurrency 5 --model gpt-5.5 --effort xhigh
 */
import { resolve } from "node:path";
import { resolveConfig, type Repo2LearnFlags } from "./config";
import type { Repo2LearnConfig } from "./types";
import { CliCodexDriver } from "./codex/cli-driver";
import { MockCodexDriver } from "./codex/mock-driver";
import { sampleResponder } from "./sample/responder";
import { runPipeline } from "./pipeline/run";
import { log } from "./util/log";

const HERE = import.meta.dirname ?? process.cwd();

function parseArgs(argv: string[]): {
  repo: string;
  flags: Repo2LearnFlags;
  sample: boolean;
} {
  const flags: Repo2LearnFlags = {};
  const positional: string[] = [];
  let sample = false;
  let idx = 0;

  const take = (): string => {
    const v = argv[++idx];
    if (v === undefined) throw new Error("missing value for flag");
    return v;
  };

  for (; idx < argv.length; idx++) {
    const a = argv[idx]!;
    switch (a) {
      case "--sample": sample = true; break;
      case "--no-cache": flags.noCache = true; break;
      case "--mock": flags.useMock = true; break;
      case "--model": flags.codex = { ...flags.codex, model: take() }; break;
      case "--effort": flags.codex = { ...flags.codex, reasoningEffort: take() }; break;
      case "--concurrency": flags.codex = { ...flags.codex, concurrency: Number(take()) }; break;
      case "--binary": flags.codex = { ...flags.codex, binary: take() }; break;
      case "--target": flags.targetLessonCount = Number(take()); break;
      case "--workdir": flags.workDir = take(); break;
      case "--out": flags.siteContentDir = take(); break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
      default:
        if (a.startsWith("--")) {
          log.warn(`unknown flag ${a}, ignoring`);
        } else {
          positional.push(a);
        }
    }
  }

  const repo = sample ? resolve(HERE, "..", "samples", "nano-agent") : positional[0];
  return { repo: repo ?? "", flags, sample };
}

function printHelp(): void {
  console.log(`
Repo2Learn — turn a repo into a layered bilingual tutorial site.

  repo2learn <repo-url-or-path> [options]

Options:
  --sample                 Offline demo using the mock driver (no codex needed)
  --no-cache               Disable cache; recompute every stage
  --mock                   Use mock driver (alias for sample-style offline runs)
  --model <id>             codex model            (default: gpt-5.5)
  --effort <level>         reasoning effort       (default: xhigh)
  --concurrency <n>        max concurrent agents   (default: 5)
  --binary <path>          codex CLI path          (default: codex)
  --target <n>             target lesson count     (default: 10)
  --workdir <path>         clone work directory
  --out <path>             generated site data dir (default: site/content/generated)
  R2L_VALIDATE=0|1         env: 0 skip validation, 1 run it (default: 1)
`);
}

async function main(): Promise<void> {
  const { repo, flags, sample } = parseArgs(process.argv.slice(2));

  const cfg = resolveConfig(flags);
  cfg.repo = repo || cfg.repo;
  if (sample) cfg.useMock = true;
  cfg.siteContentDir = resolve(HERE, "..", cfg.siteContentDir);
  cfg.cacheDir = resolve(HERE, "..", cfg.cacheDir);
  cfg.workDir = resolve(HERE, "..", cfg.workDir);

  if (!cfg.repo) {
    printHelp();
    process.exit(1);
  }

  const mode = sample ? "MOCK (offline)" : "codex " + cfg.codex.model + "/" + cfg.codex.reasoningEffort + " concurrency " + cfg.codex.concurrency;
  log.stage("Repo2Learn repo=" + cfg.repo + " " + mode);

  const driver = cfg.useMock
    ? new MockCodexDriver({ responder: sampleResponder, delayMs: 120 })
    : new CliCodexDriver(cfg.codex);

  const course = await runPipeline({ cfg, driver });
  const { runRenderStage } = await import("./pipeline/render");
  await runRenderStage({ course, cfg });
  log.ok("Done. Run the site with:  npm -w site run dev");
}

main().catch((e: unknown) => {
  log.error((e as Error).message);
  process.exit(1);
});
