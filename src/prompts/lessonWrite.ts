import type { EnOutlineLesson } from "../types";

/** Stage 3b — write the rich ENGLISH lesson body using the read result. Enforces depth. */
export function lessonWritePrompt(lesson: EnOutlineLesson, readResult: string): string {
  return `Write ONE lesson of a deep, layered tutorial (learn.shareai.run caliber) — in ENGLISH ONLY. Teach the single mechanism using the project's REAL code, dissected line-by-line.

LESSON: ${lesson.id} — ${lesson.title}
READ RESULT (what was found in the real code):
${readResult}

DEPTH REQUIREMENTS — do ALL of these:
- problem: the intuition and why it matters (not a restatement of the title).
- howItWorks: 4–7 steps. Each step quotes REAL code (quote whole functions/expressions when useful; put the most important line numbers in highlightLines). Add "anatomy" with line-by-line notes where it aids understanding. Use "beforeCode" for before/after contrasts where instructive.
- deepDive: SEVERAL paragraphs — WHY this design, the trade-offs, alternatives that were rejected and why, history/context, performance or safety implications. Cite authoritative web references (title + url).
- compare: a table contrasting this approach vs the naive/obvious alternative.
No filler, no generic advice — everything tied to THIS codebase and the files that were read.

Return STRICT JSON ONLY (English only):
{
  "id": "${lesson.id}",
  "problem": "...",
  "howItWorks": [
    { "title": "...", "desc": "...", "code": {"file":"real/path","language":"ts","snippet":"<real code>","highlightLines":[3,4]},
      "anatomy": "<optional line-by-line notes>", "beforeCode": {"file":"...","language":"...","snippet":"...","highlightLines":[]} }
  ],
  "deepDive": "...",
  "references": [{"title":"...","url":"https://..."}],
  "compare": {"rows":[{"label":"...","a":"naive approach","b":"this approach"}]},
  "loc": 0,
  "filesUsed": ["real/path"]
}
JSON only, English only.`;
}
