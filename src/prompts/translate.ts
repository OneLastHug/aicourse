/** Stage 6 — translate the generated CHINESE course to bilingual (ZH→EN): the
 *  Chinese is the original (kept verbatim), English is translated from it.
 *
 *  Split into an outline call + per-lesson body calls (see pipeline/translate.ts):
 *  each call is small/fast/reliable, instead of one giant whole-course call that
 *  frequently returned an empty last message ("no JSON value found"). */

/** Stage 6a — translate the Chinese outline (course meta + sections + lesson meta) to bilingual. */
export function translateOutlinePrompt(zhOutlineJson: string): string {
  return `Translate this Chinese course outline into English, producing a bilingual outline. The Chinese is the ORIGINAL — keep it verbatim; add the English translation alongside.

Rules:
- Every user-facing text field becomes an object {"zh":"<原始中文>","en":"<English translation>"}: course.title, course.tagline, course.thesis, course.spine, archDiagram.caption, each section.title and section.summary, each lesson.title, lesson.theProblem, lesson.objective.
- The "zh" value MUST be the original Chinese text unchanged; "en" is your faithful English translation.
- archDiagram.diagram (the Mermaid text), ids, difficulty, keyFiles, prereq, tags, and repo.{url,name,sha} stay exactly as-is (NOT translated). If archDiagram is present, keep it (translate only its caption).
- Keep the exact same JSON structure; only the leaf text fields listed above become bilingual.
- Do NOT include lesson bodies (howItWorks/deepDive) — outline only.

Return STRICT JSON ONLY — the bilingual outline: { "course": {...}, "archDiagram"?: {...}, "sections": [...] }.

CHINESE OUTLINE (JSON):
${zhOutlineJson}`;
}

/** Stage 6b — translate one Chinese lesson body to bilingual (keep code/paths/ids/diagram/spine/badges as-is). */
export function translateLessonPrompt(lessonId: string, zhLessonJson: string): string {
  return `Translate this Chinese lesson body (${lessonId}) into English, producing a bilingual lesson. The Chinese is the ORIGINAL — keep it verbatim; add the English translation alongside.

Rules:
- Every user-facing text field becomes an object {"zh":"<原始中文>","en":"<English translation>"}: principle, problem, solution, diagram.caption, each howItWorks step's title/desc/anatomy, deepDive, tryIt, each compare.rows label.
- The "zh" value MUST be the original Chinese text unchanged; "en" is your faithful English translation. For tryIt keep each line aligned (same \\n structure).
- Code snippets (code.snippet/before), code.file/language/highlightLines/isSpine/symbol, diagram.diagram (the Mermaid text), the entire spine object, the entire badges object, file paths, ids, URLs, compare.rows a/b, references.title/url, loc, filesUsed stay exactly as-is (NOT translated).
- Translate prose faithfully and naturally for an English technical reader; keep all technical precision.
- deepDive may contain Markdown (## subheadings, - bullets, **bold**, \`code\`) — keep all those markers, translate only the text.
- Keep the exact same JSON structure; only the leaf text fields listed above become bilingual.

Return STRICT JSON ONLY — the bilingual lesson body.

CHINESE LESSON (JSON):
${zhLessonJson}`;
}
