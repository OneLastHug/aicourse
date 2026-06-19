import type { OutlineLesson, RepoContext } from "../types";

/**
 * Prompt for a Stage-2 "lesson" sub-agent. It reads the real files for ONE
 * lesson and fills the full bilingual body (problem → how-it-works steps with
 * real code → deep dive with web references → compare). Produces strict JSON.
 */
export function lessonPrompt(ctx: RepoContext, lesson: OutlineLesson, allTitles: string): string {
  const keyFileBodies = lesson.keyFiles
    .slice(0, 8)
    .map((p) => {
      const f = ctx.keyFiles.find((k) => k.path === p);
      return f ? `### ${f.path}\n\`\`\`\n${f.excerpt}\n\`\`\`` : `### ${p} (read it from disk)`;
    })
    .join("\n\n");

  return `You are a senior engineering educator writing ONE lesson of a layered tutorial (style of "learn.shareai.run"). The lesson teaches a single mechanism of a real project, using the project's REAL code.

You are running INSIDE the repo at "${ctx.localPath}". Read the files referenced below (and any others you need) for accurate, real code snippets. You may search the web for official docs/concepts to enrich the Deep Dive; include titles + URLs as references.

PROJECT: ${ctx.name} — ${ctx.summary.en}

THIS LESSON: ${lesson.id} — ${lesson.title.en}
Problem to address: ${lesson.theProblem.en}
Objective: ${lesson.objective.en}
Difficulty: ${lesson.difficulty}

OTHER LESSONS (for context/sequencing; do NOT duplicate them):
${allTitles}

KEY FILES FOR THIS LESSON:
${keyFileBodies}

TASK
Produce the full bilingual body for this one lesson. The "howItWorks" array has 3–5 steps, each with a REAL code snippet quoted from the project (small, focused, with the line numbers that matter most in highlightLines). End with a Deep Dive (concept + trade-offs + web references) and a short Compare table.

Return STRICT JSON ONLY (no prose, no fences):

{
  "id": "${lesson.id}",
  "problem": { "zh": "...", "en": "..." },
  "howItWorks": [
    {
      "title": { "zh": "...", "en": "..." },
      "desc": { "zh": "explanation of this step", "en": "..." },
      "code": { "file": "path/from/tree.ts", "language": "ts", "snippet": "<real code>", "highlightLines": [3, 4] }
    }
  ],
  "deepDive": { "zh": "...", "en": "..." },
  "references": [ { "title": "...", "url": "https://..." } ],
  "compare": {
    "rows": [
      { "label": { "zh": "...", "en": "..." }, "a": "before/without", "b": "after/with" }
    ]
  },
  "loc": <approx lines of code this lesson centers on>
}

Rules:
- Quote REAL code from the project; keep snippets short (4–20 lines). language must match the file.
- highlightLines are 1-based line numbers within snippet.
- Fill BOTH zh and en everywhere. zh = Simplified Chinese.
- references may be empty if web search yields nothing, but try to include 1–3 authoritative links.
- Output ONLY the JSON object.`;
}
