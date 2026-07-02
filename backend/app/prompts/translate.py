from __future__ import annotations


def translate_outline_prompt(zh_outline_json: str) -> str:
    return f"""Translate this Chinese course outline into English, producing the final bilingual Outline.

The Chinese-first JSON is the source of truth, but it intentionally uses English for title-like fields.
Keep every zh value verbatim and add faithful English translations.

Rules:
- Every user-facing text field becomes {{"zh":"<原始中文>","en":"<English translation>"}}.
- Title-like fields are intentionally English even for the Chinese UI. For course.title, every section.title, and every lesson.title, keep the `zh` value in English and set `en` to the same English title or a minimal casing cleanup. Do not create Chinese titles.
- Translate: course.tagline, course.spine, course.thesis, course.audience, course.whyThisOrder, archDiagram.caption, section summary/spine/role/transitionIn/transitionOut, and lesson theProblem/objective/mechanism/whyNow/missingBefore/nextPressure.
- Convert each lesson's `filesToRead` to final `keyFiles`.
- Keep ids, difficulty, keyFiles, prereq, tags, repo.url/name/sha, and archDiagram.diagram exactly as-is.
- Keep the exact section/lesson order.
- Include final `sections` and flattened final `lessons`.
- Do not include lesson bodies.

Return STRICT JSON ONLY matching the final Outline schema.

CHINESE OUTLINE JSON:
{zh_outline_json}
"""


def translate_lesson_prompt(lesson_id: str, zh_lesson_json: str) -> str:
    return f"""Translate this Chinese lesson body ({lesson_id}) into English, producing the final bilingual Lesson.

The Chinese-first JSON is the source of truth, but it intentionally uses English for title-like fields.
Keep every zh value verbatim and add faithful English translations.

Rules:
- Every user-facing text field becomes {{"zh":"<原始中文>","en":"<English translation>"}}.
- Title-like fields are intentionally English even for the Chinese UI. For each howItWorks title, keep the `zh` value in English and set `en` to the same English title or a minimal casing cleanup. Do not create Chinese step titles.
- Translate: principle, teachingScope, problem, solution, diagram.caption, each howItWorks desc/anatomy, deepDive, deepSource, sourceCompare.simplified, sourceCompare.real, every sourceCompare.gaps field, tryIt setup/commands/observe items, references.whyUsed, whatsNext, and compare.rows labels.
- Keep ids, code snippets, code.file/language/highlightLines/before/isSpine/symbol, diagram.diagram, spine, references.title/url/kind, compare.rows a/b, badges, loc, status, error, and file paths exactly as-is.
- `filesUsed` is an intermediate Chinese field and must not appear in the final Lesson.
- If status is missing, set it to "ok".
- Keep Markdown structure in deepDive and deepSource; translate text only.

Return STRICT JSON ONLY matching the final Lesson schema.

CHINESE LESSON JSON:
{zh_lesson_json}
"""
