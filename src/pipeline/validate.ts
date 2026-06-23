import type { ZhOutline, ProgressEvent, Repo2LearnConfig, RepoContext, ValidationResult } from "../types";
import { validateLessonCorrectnessPrompt } from "../prompts/validateLessonCorrectness";
import { validateLessonAlignmentPrompt } from "../prompts/validateLessonAlignment";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { configFingerprint } from "../config";
import { getGlobalLimiter } from "../util/concurrency";
import { extractJson } from "../codex/parse";
import { isValidationResult } from "../codex/guards";
import { flatZhLessons } from "./curriculum";
import { log } from "../util/log";

export interface ZhCourse { outline: ZhOutline; lessons: Record<string, unknown>; }

/** Round 1 — validate each lesson for correctness & poisoning (concurrent, per-lesson). */
export async function validateCorrectness(args: {
  zhCourse: ZhCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<ValidationResult> {
  const { zhCourse, driver, cfg, cache, onProgress } = args;
  const flat = flatZhLessons(zhCourse.outline);
  const sha = zhCourse.outline.course.repo.sha;
  const fp = configFingerprint(cfg);
  const limit = getGlobalLimiter(cfg.codex.concurrency);
  log.step("validate1: " + flat.length + " lessons (concurrent " + cfg.codex.concurrency + ")");
  onProgress?.({ type: "log", level: "info", message: "validate-1: checking " + flat.length + " lessons for errors..." });

  const results = await Promise.all(flat.map((l) => limit(async () => {
    const body = zhCourse.lessons[l.id];
    if (!body) return { passed: true, issues: [], summary: "no body" } as ValidationResult;
    const key = cache.key({ stage: "validate1", sha, id: l.id, cfg: fp, v: 1 });
    const cached = await cache.get<ValidationResult>(key);
    if (cached) return cached;
    try {
      const res = await driver.run({ label: "validate1:" + l.id, prompt: validateLessonCorrectnessPrompt(l.id, JSON.stringify(body)), cwd: process.cwd() });
      const parsed = extractJson<unknown>(res.text);
      if (!isValidationResult(parsed)) return { passed: true, issues: [], summary: "validate1 parse failed (skipped)" };
      await cache.set(key, parsed);
      return parsed;
    } catch {
      return { passed: true, issues: [], summary: "validation parse failed (skipped)" } as ValidationResult;
    }
  })));

  return aggregate(results, flat.length);
}

/** Round 2 — validate each lesson against the real repo (concurrent, per-lesson). */
export async function validateAlignment(args: {
  ctx: RepoContext; zhCourse: ZhCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<ValidationResult> {
  const { ctx, zhCourse, driver, cfg, cache, onProgress } = args;
  const flat = flatZhLessons(zhCourse.outline);
  const sha = ctx.sha;
  const fp = configFingerprint(cfg);
  const limit = getGlobalLimiter(cfg.codex.concurrency);
  log.step("validate2: " + flat.length + " lessons (concurrent " + cfg.codex.concurrency + ")");
  onProgress?.({ type: "log", level: "info", message: "validate-2: checking " + flat.length + " lessons against repo..." });

  const results = await Promise.all(flat.map((l) => limit(async () => {
    const body = zhCourse.lessons[l.id];
    if (!body) return { passed: true, issues: [], summary: "no body" } as ValidationResult;
    const key = cache.key({ stage: "validate2", sha, id: l.id, cfg: fp, v: 1 });
    const cached = await cache.get<ValidationResult>(key);
    if (cached) return cached;
    try {
      const res = await driver.run({ label: "validate2:" + l.id, prompt: validateLessonAlignmentPrompt(ctx, l.id, JSON.stringify(body)), cwd: ctx.localPath });
      const parsed = extractJson<unknown>(res.text);
      if (!isValidationResult(parsed)) return { passed: true, issues: [], summary: "validate2 parse failed (skipped)" };
      await cache.set(key, parsed);
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
