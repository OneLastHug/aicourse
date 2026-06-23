import type { ZhOutlineLesson } from "../types";

/** Stage 3b — write the rich CHINESE lesson body using the read result. Enforces depth. */
export function lessonWritePrompt(lesson: ZhOutlineLesson, readResult: string): string {
  return `Write ONE lesson of a deep, layered tutorial (learn.shareai.run caliber) — IN SIMPLIFIED CHINESE (中文). Teach the single mechanism using the project's REAL code, dissected line-by-line.

LESSON: ${lesson.id} — ${lesson.title}
READ RESULT (what was found in the real code):
${readResult}

DEPTH REQUIREMENTS — do ALL of these (all prose in Chinese):
- problem: the intuition and why it matters (not a restatement of the title).
- howItWorks: 4–7 steps. Each step quotes REAL code (quote whole functions/expressions when useful; put the most important line numbers in highlightLines). Add "anatomy" with line-by-line notes where it aids understanding. Use "beforeCode" for before/after contrasts where instructive.
- deepDive: SEVERAL paragraphs — WHY this design, the trade-offs, alternatives that were rejected and why, history/context, performance or safety implications. Cite authoritative web references (title + url).
- compare: a table contrasting this approach vs the naive/obvious alternative.
No filler, no generic advice — everything tied to THIS codebase and the files that were read.

Return STRICT JSON ONLY. Chinese prose for problem/howItWorks (title+desc+anatomy)/deepDive/compare (label+a+b); keep code, file paths, ids, language, highlightLines, and reference titles+urls as-is:
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
Output RFC 8259 JSON ONLY — start with '{' and end with '}'. Use double quotes for
every key and string; inside "snippet" escape newlines as \\n, double-quotes as \\"
and backslashes as \\\\. No single quotes, no comments, no trailing commas, no
markdown fences, no prose before or after. JSON only, Chinese prose only.`;
}
