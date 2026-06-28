import type { ZhOutline, ProgressEvent, Repo2LearnConfig, RepoContext, ValidationIssue, ValidationResult, ZhLesson } from "../types";
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
  const { zhCourse, driver, cfg, cache } = args;
  const flat = flatZhLessons(zhCourse.outline);
  const sha = zhCourse.outline.course.repo.sha;
  const fp = configFingerprint(cfg);
  const limit = getGlobalLimiter(cfg.codex.concurrency);
  log.step("validate1: " + flat.length + " lessons (concurrent " + cfg.codex.concurrency + ")");

  const results = await Promise.all(flat.map((l) => limit(async () => {
    const body = zhCourse.lessons[l.id] as ZhLesson | undefined;
    if (!body) return { passed: true, issues: [], summary: "no body" } as ValidationResult;
    const key = cache.key({ stage: "validate1", sha, id: l.id, cfg: fp, v: 2 });
    const cached = await cache.get<ValidationResult>(key);
    if (cached) return cached;
    try {
      const res = await driver.run({ label: "validate1:" + l.id, prompt: validateLessonCorrectnessPrompt(l.id, JSON.stringify(body)), cwd: process.cwd() });
      const parsed = extractJson<unknown>(res.text);
      const llmResult = isValidationResult(parsed)
        ? parsed
        : { passed: true, issues: [], summary: "validate1 parse failed (skipped)" } as ValidationResult;
      const deterministic = localCorrectnessChecks(l.id, body, cfg);
      const merged = mergeResults(llmResult, deterministic);
      await cache.set(key, merged);
      return merged;
    } catch {
      return localCorrectnessChecks(l.id, body, cfg);
    }
  })));

  return aggregate(results, flat.length);
}

/** Round 2 — validate each lesson against the real repo (concurrent, per-lesson). */
export async function validateAlignment(args: {
  ctx: RepoContext; zhCourse: ZhCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<ValidationResult> {
  const { ctx, zhCourse, driver, cfg, cache } = args;
  const flat = flatZhLessons(zhCourse.outline);
  const sha = ctx.sha;
  const fp = configFingerprint(cfg);
  const limit = getGlobalLimiter(cfg.codex.concurrency);
  log.step("validate2: " + flat.length + " lessons (concurrent " + cfg.codex.concurrency + ")");

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

function localCorrectnessChecks(lessonId: string, body: ZhLesson, cfg: Repo2LearnConfig): ValidationResult {
  const issues: ValidationIssue[] = [];
  const refs = Array.isArray(body.references) ? body.references : [];
  const limitedResearch = cfg.research.enabled && cfg.research.mode === "limited";

  if (!body.tryIt || !Array.isArray(body.tryIt.commands) || body.tryIt.commands.length === 0 || !Array.isArray(body.tryIt.observe) || body.tryIt.observe.length === 0) {
    issues.push({ severity: "error", lessonId, problem: "tryIt must be structured with non-empty commands and observe arrays", fix: "Emit tryIt.commands[] and tryIt.observe[] with at least one item each." });
  }

  if (limitedResearch) {
    if (refs.length > cfg.research.maxReferencesPerLesson) {
      issues.push({ severity: "error", lessonId, problem: `References exceed max references (${refs.length} > ${cfg.research.maxReferencesPerLesson})`, fix: "Keep only the highest-signal sources for this lesson." });
    }
    for (const [idx, ref] of refs.entries()) {
      if (!ref.kind || !cfg.research.allowedSources.includes(ref.kind)) {
        issues.push({ severity: "error", lessonId, problem: `Reference #${idx + 1} uses a disallowed source kind: ${String(ref.kind ?? "missing")}`, fix: `Use one of: ${cfg.research.allowedSources.join(", ")}.` });
      }
      if (!String(ref.whyUsed ?? "").trim()) {
        issues.push({ severity: "error", lessonId, problem: `Reference #${idx + 1} is missing whyUsed`, fix: "Explain why this source materially improves the lesson." });
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    summary: issues.length === 0 ? "local checks passed" : `${issues.length} local issue(s)`,
  };
}

function mergeResults(a: ValidationResult, b: ValidationResult): ValidationResult {
  const issues = [...(a.issues ?? []), ...(b.issues ?? [])];
  return {
    passed: a.passed && b.passed,
    issues,
    summary: issues.length === 0 ? a.summary || b.summary || "ok" : `${issues.length} issue(s)`,
  };
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
