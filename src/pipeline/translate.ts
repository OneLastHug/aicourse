import type { Course, ProgressEvent, Repo2LearnConfig } from "../types";
import { translatePrompt } from "../prompts/translate";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { flatEnLessons } from "./curriculum";
import { codexJson } from "./_call";
import { isCourse } from "../codex/guards";
import type { EnCourse } from "./validate";

/** Stage 6 — translate the validated English course to bilingual (EN→ZH), whole-course. */
export async function runTranslateStage(args: {
  enCourse: EnCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<Course> {
  const { enCourse, driver, cfg, cache, onProgress } = args;
  // Defensive: if outline or sections are missing, the course can't be translated.
  if (!enCourse?.outline?.sections?.length) {
    throw new Error("translate: enCourse.outline.sections is missing or empty (pipeline assembly bug)");
  }
  const flat = flatEnLessons(enCourse.outline);
  const key = cache.key({ stage: "translate", sha: enCourse.outline.course.repo.sha, n: flat.length, v: 2 });
  const cached = await cache.get<Course>(key);
  if (cached) { onProgress?.({ type: "log", level: "info", message: "translate cache hit" }); return cached; }

  const payload = JSON.stringify({
    course: enCourse.outline.course,
    sections: enCourse.outline.sections,
    lessons: flat.map((l) => ({ id: l.id, ...((enCourse.lessons[l.id] as object) ?? {}) })),
  });
  // Validate the translator's output shape (guard) and retry once on failure. A bare
  // extractJson+cast here previously crashed with "Cannot read properties of undefined
  // (reading 'sections')" when the model omitted `outline` entirely.
  const course = await codexJson<Course>({
    driver, label: "translate", cwd: process.cwd(), guard: isCourse, name: "translate",
    prompt: translatePrompt(payload),
  });
  flattenOutline(course);
  await cache.set(key, course);
  return course;
}

/** Ensure outline.lessons (flat) is populated from sections, for site backward-compat. */
export function flattenOutline(course: Course): void {
  if (!course?.outline?.sections) return;
  course.outline.lessons = course.outline.sections.flatMap((s) => s.lessons);
  for (const l of course.outline.lessons) {
    if (!course.lessons[l.id]) {
      course.lessons[l.id] = { id: l.id, problem: l.theProblem, howItWorks: [], deepDive: { zh: "", en: "" }, references: [], compare: { rows: [] }, loc: 0, status: "failed", error: "missing body" };
    }
  }
}
