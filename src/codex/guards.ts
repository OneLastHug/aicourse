import type { Bi, Course, ZhLesson, ZhOutline, Lesson, Outline, RepoContext, SpineArtifact, ValidationResult } from "../types";

export function isStr(v: unknown): v is string { return typeof v === "string"; }
export function isBi(v: unknown): v is Bi {
  return typeof v === "object" && v !== null && isStr((v as Record<string, unknown>).zh) && isStr((v as Record<string, unknown>).en);
}
function isBiArray(v: unknown): v is Bi[] { return Array.isArray(v) && v.every(isBi); }
export function isRepoContext(v: unknown): v is RepoContext {
  const r = v as RepoContext;
  return typeof v === "object" && v !== null && isStr(r.url) && isStr(r.localPath) && isStr(r.sha) && isStr(r.name) && Array.isArray(r.tree);
}
export function isZhOutline(v: unknown): v is ZhOutline {
  const o = v as ZhOutline;
  if (typeof v !== "object" || v === null || !o.course || !Array.isArray(o.sections)) return false;
  return o.sections.every((s) => isStr(s.id) && isStr(s.title) && Array.isArray(s.lessons) && s.lessons.every((l) => isStr(l.id) && isStr(l.title) && Array.isArray(l.filesToRead)));
}
export function isZhLesson(v: unknown): v is ZhLesson {
  const l = v as ZhLesson;
  return typeof v === "object" && v !== null && isStr(l.id) && isStr(l.problem) && Array.isArray(l.howItWorks);
}
export function isSpineArtifact(v: unknown): v is SpineArtifact {
  const s = v as SpineArtifact;
  return typeof v === "object" && v !== null && isStr(s.path) && isStr(s.language) && isStr(s.code);
}
export function isOutline(v: unknown): v is Outline {
  const o = v as Outline;
  if (typeof v !== "object" || v === null || !o.course || !Array.isArray(o.sections)) return false;
  return Array.isArray(o.lessons);
}
export function isBiOutline(v: unknown): v is Outline {
  const o = v as Outline;
  if (typeof v !== "object" || v === null || !o.course || !Array.isArray(o.sections)) return false;
  return o.sections.every((s) => isStr(s.id) && isBi(s.title) && isBi(s.summary) && Array.isArray(s.lessons) && s.lessons.every((l) => isStr(l.id) && isBi(l.title) && isBi(l.theProblem) && isBi(l.objective)));
}
export function isLesson(v: unknown): v is Lesson {
  const l = v as Lesson;
  if (typeof v !== "object" || v === null || !isStr(l.id) || !isBi(l.problem)) return false;
  if (!Array.isArray(l.howItWorks)) return false;
  if (l.tryIt) {
    const t = l.tryIt as NonNullable<Lesson["tryIt"]>;
    if (!isBiArray(t.commands) || !isBiArray(t.observe)) return false;
    if (t.setup && !isBiArray(t.setup)) return false;
  }
  if (l.sourceCompare?.gaps && !Array.isArray(l.sourceCompare.gaps)) return false;
  return true;
}
export function isCourse(v: unknown): v is Course {
  const c = v as Course;
  if (typeof v !== "object" || v === null) return false;
  const o = c.outline;
  if (typeof o !== "object" || o === null || !o.course || !Array.isArray(o.sections)) return false;
  if (typeof c.lessons !== "object" || c.lessons === null) return false;
  return o.sections.every((s) => isStr(s.id) && isBi(s.title) && Array.isArray(s.lessons) && s.lessons.every((l) => isStr(l.id) && isBi(l.title)));
}
export function isValidationResult(v: unknown): v is ValidationResult {
  const r = v as ValidationResult;
  return typeof v === "object" && v !== null && typeof r.passed === "boolean" && Array.isArray(r.issues) && isStr(r.summary);
}
