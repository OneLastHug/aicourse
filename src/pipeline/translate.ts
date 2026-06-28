import type { Course, ZhLesson, Lesson, Outline, ProgressEvent, Repo2LearnConfig } from "../types";
import { translateOutlinePrompt, translateLessonPrompt } from "../prompts/translate";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { flatZhLessons } from "./curriculum";
import { codexJson } from "./_call";
import { isBiOutline, isLesson } from "../codex/guards";
import { getGlobalLimiter } from "../util/concurrency";
import { configFingerprint } from "../config";
import { log } from "../util/log";
import type { ZhCourse } from "./validate";

/** Stage 6 — translate the generated CHINESE course to bilingual (ZH→EN): zh is
 *  the original Chinese, en is translated from it. Split into one outline call +
 *  per-lesson body calls (concurrent, cached), so each call is small/fast/reliable
 *  instead of one giant whole-course call that returned an empty last message
 *  ("no JSON value found") on large courses. */
export async function runTranslateStage(args: {
  zhCourse: ZhCourse; driver: CodexDriver; cfg: Repo2LearnConfig; cache: Cache; onProgress?: (e: ProgressEvent) => void;
}): Promise<Course> {
  const { zhCourse, driver, cfg, cache, onProgress } = args;
  // Defensive: if outline or sections are missing, the course can't be translated.
  if (!zhCourse?.outline?.sections?.length) {
    throw new Error("translate: zhCourse.outline.sections is missing or empty (pipeline assembly bug)");
  }
  const sha = zhCourse.outline.course.repo.sha;
  const flat = flatZhLessons(zhCourse.outline);
  const fp = configFingerprint(cfg);

  // Fast path: a prior full translate exists.
  const wholeKey = cache.key({ stage: "translate", sha, n: flat.length, cfg: fp, v: 7 });
  const cachedCourse = await cache.get<Course>(wholeKey);
  if (cachedCourse) { onProgress?.({ type: "log", level: "info", message: "translate cache hit" }); return cachedCourse; }

  // 1) Outline (course meta + sections + lesson meta) — one small call, cached.
  const outlineKey = cache.key({ stage: "translate.outline", sha, cfg: fp, v: 3 });
  let outline = await cache.get<Outline>(outlineKey);
  if (!outline) {
    log.step("translate: outline · " + flat.length + " lessons");
    outline = await codexJson<Outline>({
      driver, label: "translate:outline", cwd: process.cwd(), guard: isBiOutline, name: "translate outline",
      prompt: translateOutlinePrompt(JSON.stringify(zhCourse.outline)),
    });
    await cache.set(outlineKey, outline);
  }

  // 2) Each lesson body — concurrent, per-lesson, cached individually so a retry
  //    only re-translates the lessons that didn't finish.
  const limit = getGlobalLimiter(cfg.codex.concurrency);
  log.step("translate: " + flat.length + " lessons (concurrent " + cfg.codex.concurrency + ")");
  const entries = await Promise.all(flat.map((l) => limit(async () => {
    const body = zhCourse.lessons[l.id] as ZhLesson | undefined;
    if (!body) return null; // flattenOutline synthesizes a placeholder below
    const lessonKey = cache.key({ stage: "translate.lesson", sha, id: l.id, cfg: fp, v: 5 });
    const cachedBody = await cache.get<Lesson>(lessonKey);
    if (cachedBody) return [l.id, cachedBody] as [string, Lesson];
    const translated = await codexJson<Lesson>({
      driver, label: `translate:lesson:${l.id}`, cwd: process.cwd(), guard: isLesson, name: `translate lesson ${l.id}`,
      prompt: translateLessonPrompt(l.id, JSON.stringify(body)),
    });
    translated.status = "ok";
    await cache.set(lessonKey, translated);
    return [l.id, translated] as [string, Lesson];
  })));
  const lessons = Object.fromEntries(entries.filter(Boolean) as [string, Lesson][]);

  // 3) Assemble + flatten (populates outline.lessons flat view, fills missing bodies).
  const course: Course = { outline, lessons };
  flattenOutline(course);
  await cache.set(wholeKey, course);
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
