/** Runtime type guards for the JSON contracts (used after codex output parsing). */
import type {
  Bi,
  HowItWorksStep,
  Lesson,
  Outline,
  OutlineLesson,
  Reference,
  RepoContext,
} from "../types";

export function isStr(v: unknown): v is string {
  return typeof v === "string";
}
export function isBi(v: unknown): v is Bi {
  return typeof v === "object" && v !== null && isStr((v as Record<string, unknown>).zh) && isStr((v as Record<string, unknown>).en);
}

export function isRepoContext(v: unknown): v is RepoContext {
  const r = v as RepoContext;
  return (
    typeof v === "object" && v !== null &&
    isStr(r.url) && isStr(r.localPath) && isStr(r.sha) && isStr(r.name) &&
    Array.isArray(r.tree) && Array.isArray(r.keyFiles)
  );
}

export function isOutline(v: unknown): v is Outline {
  const o = v as Outline;
  if (typeof v !== "object" || v === null) return false;
  const c = o.course;
  if (!c || !isBi(c.title) || !isBi(c.tagline)) return false;
  if (!Array.isArray(o.lessons)) return false;
  return o.lessons.every(isOutlineLesson);
}

export function isOutlineLesson(v: unknown): v is OutlineLesson {
  const l = v as OutlineLesson;
  return (
    typeof v === "object" && v !== null &&
    isStr(l.id) && isBi(l.title) && isBi(l.theProblem) && isBi(l.objective) &&
    Array.isArray(l.keyFiles) && Array.isArray(l.prereq)
  );
}

export function isLesson(v: unknown): v is Lesson {
  const l = v as Lesson;
  if (typeof v !== "object" || v === null) return false;
  if (!isStr(l.id) || !isBi(l.problem) || !isBi(l.deepDive)) return false;
  if (!Array.isArray(l.howItWorks)) return false;
  if (!l.howItWorks.every(isStep)) return false;
  if (!Array.isArray(l.references) || !l.references.every(isReference)) return false;
  if (l.compare && !Array.isArray(l.compare.rows)) return false;
  return true;
}

function isStep(v: unknown): v is HowItWorksStep {
  const s = v as HowItWorksStep;
  if (typeof v !== "object" || v === null) return false;
  if (!isBi(s.title) || !isBi(s.desc)) return false;
  if (s.code) {
    const c = s.code;
    return isStr(c.file) && isStr(c.language) && isStr(c.snippet) && Array.isArray(c.highlightLines);
  }
  return true;
}

function isReference(v: unknown): v is Reference {
  const r = v as Reference;
  return typeof v === "object" && v !== null && isStr(r.title) && isStr(r.url);
}
