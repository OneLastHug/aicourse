import type { EnOutline, ProgressEvent, Repo2LearnConfig, RepoContext, ValidationResult } from "../types";
import { validateCorrectnessPrompt } from "../prompts/validateCorrectness";
import { validateAlignmentPrompt } from "../prompts/validateAlignment";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { codexJson } from "./_call";
import { isValidationResult } from "../codex/guards";
import { flatEnLessons } from "./curriculum";

export interface EnCourse { outline: EnOutline; lessons: Record<string, unknown>; }

export function enCourseJson(c: EnCourse): string {
  const flat = flatEnLessons(c.outline);
  const lessons = flat.map((l) => ({ meta: l, body: c.lessons[l.id] }));
  return JSON.stringify({ course: c.outline.course, sections: c.outline.sections, lessons });
}

/** Round 1 — correctness & poisoning (no repo access needed). */
export async function validateCorrectness(args: {
  enCourse: EnCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<ValidationResult> {
  const { enCourse, driver, cfg, cache, onProgress } = args;
  const key = cache.key({ stage: "validate1", sha: cfg.repo, cfg: cfg.codex.model, v: 2 });
  const cached = await cache.get<ValidationResult>(key);
  if (cached) { onProgress?.({ type: "validation", round: 1, passed: cached.passed, issueCount: cached.issues.length }); return cached; }
  const r = await codexJson({
    driver, label: "validate1", cwd: process.cwd(), guard: isValidationResult, name: "validate1",
    prompt: validateCorrectnessPrompt(enCourseJson(enCourse)),
  });
  await cache.set(key, r);
  onProgress?.({ type: "validation", round: 1, passed: r.passed, issueCount: r.issues.length });
  return r;
}

/** Round 2 — alignment vs the real repo (agent runs inside the repo). */
export async function validateAlignment(args: {
  ctx: RepoContext; enCourse: EnCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<ValidationResult> {
  const { ctx, enCourse, driver, cfg, cache, onProgress } = args;
  const key = cache.key({ stage: "validate2", sha: ctx.sha, cfg: cfg.codex.model, v: 2 });
  const cached = await cache.get<ValidationResult>(key);
  if (cached) { onProgress?.({ type: "validation", round: 2, passed: cached.passed, issueCount: cached.issues.length }); return cached; }
  const r = await codexJson({
    driver, label: "validate2", cwd: ctx.localPath, guard: isValidationResult, name: "validate2",
    prompt: validateAlignmentPrompt(ctx, enCourseJson(enCourse)),
  });
  await cache.set(key, r);
  onProgress?.({ type: "validation", round: 2, passed: r.passed, issueCount: r.issues.length });
  return r;
}
