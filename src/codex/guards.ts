import type { Bi, EnLesson, EnOutline, Lesson, Outline, RepoContext, ValidationResult } from "../types";

export function isStr(v: unknown): v is string { return typeof v === "string"; }
export function isBi(v: unknown): v is Bi {
  return typeof v === "object" && v !== null && isStr((v as Record<string, unknown>).zh) && isStr((v as Record<string, unknown>).en);
}
export function isRepoContext(v: unknown): v is RepoContext {
  const r = v as RepoContext;
  return typeof v === "object" && v !== null && isStr(r.url) && isStr(r.localPath) && isStr(r.sha) && isStr(r.name) && Array.isArray(r.tree);
}
export function isEnOutline(v: unknown): v is EnOutline {
  const o = v as EnOutline;
  if (typeof v !== "object" || v === null || !o.course || !Array.isArray(o.sections)) return false;
  return o.sections.every((s) => isStr(s.id) && isStr(s.title) && Array.isArray(s.lessons) && s.lessons.every((l) => isStr(l.id) && isStr(l.title) && Array.isArray(l.filesToRead)));
}
export function isEnLesson(v: unknown): v is EnLesson {
  const l = v as EnLesson;
  return typeof v === "object" && v !== null && isStr(l.id) && isStr(l.problem) && Array.isArray(l.howItWorks);
}
export function isOutline(v: unknown): v is Outline {
  const o = v as Outline;
  if (typeof v !== "object" || v === null || !o.course || !Array.isArray(o.sections)) return false;
  const flat = o.lessons;
  return Array.isArray(flat);
}
export function isLesson(v: unknown): v is Lesson {
  const l = v as Lesson;
  if (typeof v !== "object" || v === null || !isStr(l.id) || !isBi(l.problem)) return false;
  return Array.isArray(l.howItWorks);
}
export function isValidationResult(v: unknown): v is ValidationResult {
  const r = v as ValidationResult;
  return typeof v === "object" && v !== null && typeof r.passed === "boolean" && Array.isArray(r.issues) && isStr(r.summary);
}
