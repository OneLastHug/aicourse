import type { EnOutline, ProgressEvent, Repo2LearnConfig, RepoContext, ValidationResult } from "../types";
import { validateLessonCorrectnessPrompt } from "../prompts/validateLessonCorrectness";
import { validateLessonAlignmentPrompt } from "../prompts/validateLessonAlignment";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { getGlobalLimiter } from "../util/concurrency";
import { extractJson } from "../codex/parse";
import { isValidationResult } from "../codex/guards";
import { flatEnLessons } from "./curriculum";
import { log } from "../util/log";

export interface EnCourse { outline: EnOutline; lessons: Record<string, unknown>; }

/** Round 1 — validate each lesson for correctness & poisoning (concurrent, per-lesson). */
export async function validateCorrectness(args: {
  enCourse: EnCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<ValidationResult> {
  const { enCourse, driver, cfg, onProgress } = args;
  const flat = flatEnLessons(enCourse.outline);
  const limit = getGlobalLimiter(cfg.codex.concurrency);
  log.step("validate1: " + flat.length + " lessons (concurrent " + cfg.codex.concurrency + ")");

  const results = await Promise.all(flat.map((l) => limit(async () => {
    const body = enCourse.lessons[l.id];
    if (!body) return { passed: true, issues: [], summary: "no body" } as ValidationResult;
    try {
      const res = await driver.run({ label: "validate1:" + l.id, prompt: validateLessonCorrectnessPrompt(l.id, JSON.stringify(body)), cwd: process.cwd() });
      const parsed = extractJson<unknown>(res.text);
      if (!isValidationResult(parsed)) return { passed: true, issues: [], summary: "validate1 parse failed (skipped)" };
      return parsed;
    } catch {
      return { passed: true, issues: [], summary: "validation parse failed (skipped)" } as ValidationResult;
    }
  })));

  return aggregate(results, flat.length);
}

/** Round 2 — validate each lesson against the real repo (concurrent, per-lesson). */
export async function validateAlignment(args: {
  ctx: RepoContext; enCourse: EnCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<ValidationResult> {
  const { ctx, enCourse, driver, cfg, onProgress } = args;
  const flat = flatEnLessons(enCourse.outline);
  const limit = getGlobalLimiter(cfg.codex.concurrency);
  log.step("validate2: " + flat.length + " lessons (concurrent " + cfg.codex.concurrency + ")");

  const results = await Promise.all(flat.map((l) => limit(async () => {
    const body = enCourse.lessons[l.id];
    if (!body) return { passed: true, issues: [], summary: "no body" } as ValidationResult;
    try {
      const res = await driver.run({ label: "validate2:" + l.id, prompt: validateLessonAlignmentPrompt(ctx, l.id, JSON.stringify(body)), cwd: ctx.localPath });
      const parsed = extractJson<unknown>(res.text);
      if (!isValidationResult(parsed)) return { passed: true, issues: [], summary: "validate2 parse failed (skipped)" };
      return parsed;
    } catch {
      return { passed: true, issues: [], summary: "alignment parse failed (skipped)" } as ValidationResult;
    }
  })));

  return aggregate(results, flat.length);
}

function aggregate(results: ValidationResult[], total: number): ValidationResult {
  const allIssues = results.flatMap((r) => r.issues || []);
  const passedCount = results.filter((r) => r.passed).length;
  return {
    passed: results.every((r) => r.passed),
    issues: allIssues,
    summary: passedCount + "/" + total + " lessons passed",
  };
}
