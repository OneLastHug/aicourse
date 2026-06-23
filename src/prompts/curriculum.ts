import type { RepoContext } from "../types";

/** Stage 2 — design a LAYERED curriculum (sections × lessons) from the analysis.
 *  Sections are coherent themes; lessons within advance a running example spine.
 *  Output is in Simplified Chinese (the primary generation language). */
export function curriculumPrompt(ctx: RepoContext, analysis: string, target: number): string {
  return `You are a senior curriculum architect. Turn the repo analysis into a LAYERED tutorial course (learn.shareai.run style: grouped into layers, building the project from 0 to 1).

REPO: ${ctx.name}
ANALYSIS (from a deep read of the real code):
${analysis}

DESIGN RULES:
- Group lessons into SECTIONS (layers), each a coherent theme (e.g. "基础", "核心引擎", "进阶"). 3–5 sections.
- Each section has 2–4 lessons; ~${target} lessons total; beginner→advanced across sections.
- Each lesson teaches exactly ONE mechanism and advances the running example spine.
- filesToRead must be REAL repo paths (the lesson agent will read them in full).
- Order so each lesson depends only on earlier ones (prereq = earlier lesson ids).

Return STRICT JSON ONLY. ALL user-facing text VALUES (title/tagline/spine/summary/theProblem/objective/mechanism) must be in Simplified Chinese; keep ids/difficulty/repo/paths as-is:
{
  "course": { "title": "...", "tagline": "...", "repo": {"url":"${ctx.url}","name":"${ctx.name}","sha":"${ctx.sha}"}, "spine": "<随每节课生长的运行示例>" },
  "sections": [
    { "id": "l01", "title": "...", "summary": "...", "spine": "<本层如何推进 spine>",
      "lessons": [
        { "id": "s01", "title": "...", "difficulty": "beginner|intermediate|advanced",
          "theProblem": "<痛点>", "objective": "<学完后能做什么>", "mechanism": "<单一机制>", "filesToRead": ["real/paths"], "prereq": [], "tags": [] }
      ]
    }
  ]
}
JSON only, Chinese values.`;
}
