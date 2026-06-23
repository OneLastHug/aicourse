/** Stage 6 — translate the validated English course to bilingual (EN→ZH).
 *
 *  Split into an outline call + per-lesson body calls (see pipeline/translate.ts):
 *  each call is small/fast/reliable, instead of one giant whole-course call that
 *  frequently returned an empty last message ("no JSON value found"). */

/** Stage 6a — translate the English outline (course meta + sections + lesson meta). */
export function translateOutlinePrompt(outlineJson: string): string {
  return `Translate this English course outline into Simplified Chinese, preserving structure.

Rules:
- Every user-facing text field becomes an object {"zh":"<中文翻译>","en":"<original English>"}: course.title, course.tagline, course.spine, each section.title and section.summary, each lesson.title, lesson.theProblem, lesson.objective.
- ids, difficulty, keyFiles, prereq, tags, and repo.{url,name,sha} stay exactly as-is (not translated).
- Translate prose faithfully and naturally for a Chinese technical reader; keep all technical precision.
- Keep the exact same JSON structure; only leaf text fields become bilingual.
- Do NOT include lesson bodies (howItWorks/deepDive) — outline only.

Return STRICT JSON ONLY — the bilingual outline: { "course": {...}, "sections": [...] }.

ENGLISH OUTLINE (JSON):
${outlineJson}`;
}

/** Stage 6b — translate one English lesson body to bilingual (keep code/paths/ids as-is). */
export function translateLessonPrompt(lessonId: string, lessonJson: string): string {
  return `Translate this English lesson body (${lessonId}) into Simplified Chinese, preserving ALL depth, structure, code, and meaning.

Rules:
- Every user-facing text field becomes an object {"zh":"<中文翻译>","en":"<original English>"}: problem, each howItWorks step's title/desc/anatomy, deepDive, each compare.rows label.
- Code snippets (code.snippet/before), file paths, ids, URLs, "language"/"highlightLines", compare.rows a/b, references.title/url, loc, filesUsed stay exactly as-is (not translated).
- Translate prose faithfully and naturally for a Chinese technical reader; keep all technical precision.
- Keep the exact same JSON structure; only leaf text fields become bilingual.

Return STRICT JSON ONLY — the bilingual lesson body.

ENGLISH LESSON (JSON):
${lessonJson}`;
}
