/** Stage 6 — translate the generated CHINESE course to bilingual (ZH→EN). */

export function translateOutlinePrompt(zhOutlineJson: string): string {
  return `Translate this Chinese course outline into English, producing a bilingual outline. The Chinese is the ORIGINAL — keep it verbatim; add the English translation alongside.

Rules:
- Every user-facing text field becomes an object {"zh":"<原始中文>","en":"<English translation>"}: course.title, course.tagline, course.thesis, course.spine, course.audience, course.whyThisOrder, archDiagram.caption, each section.title/summary/spine/role/transitionIn/transitionOut, each lesson.title/theProblem/objective/mechanism/whyNow/missingBefore/nextPressure.
- The "zh" value MUST be the original Chinese text unchanged; "en" is your faithful English translation.
- archDiagram.diagram, ids, difficulty, keyFiles, prereq, tags, and repo.{url,name,sha} stay exactly as-is.
- Keep the exact same JSON structure; only the listed leaf text fields become bilingual.
- Do NOT include lesson bodies — outline only.

Return STRICT JSON ONLY — the bilingual outline.

CHINESE OUTLINE (JSON):
${zhOutlineJson}`;
}

export function translateLessonPrompt(lessonId: string, zhLessonJson: string): string {
  return `Translate this Chinese lesson body (${lessonId}) into English, producing a bilingual lesson. The Chinese is the ORIGINAL — keep it verbatim; add the English translation alongside.

Rules:
- Every user-facing text field becomes {"zh":"<原始中文>","en":"<English translation>"}: principle, teachingScope, problem, solution, diagram.caption, each howItWorks step's title/desc/anatomy, deepDive, deepSource, whatsNext, each compare.rows label, sourceCompare.simplified, sourceCompare.real, and every sourceCompare.gaps field (dimension/simplified/real/whySimplified).
- tryIt becomes bilingual per element: setup/commands/observe arrays become arrays of Bi items, preserving order and count.
- references.kind/title/url stay exactly as-is; references.whyUsed becomes bilingual.
- Code snippets, code.file/language/highlightLines/isSpine/symbol, diagram.diagram, the entire spine object, badges, file paths, ids, URLs, compare.rows a/b, loc, filesUsed stay exactly as-is.
- deepDive and deepSource may contain Markdown — keep ALL markers/table structure intact, translate only the text.
- Keep the exact same JSON structure; only the listed leaf text fields become bilingual.

Return STRICT JSON ONLY — the bilingual lesson body.

CHINESE LESSON (JSON):
${zhLessonJson}`;
}
