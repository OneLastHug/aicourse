import type { RepoContext } from "../types";

/**
 * Prompt for the Stage-1 "architect" agent. Given a RepoContext it produces a
 * strictly-JSON, ordered, layered outline (s01..sN) that teaches the project
 * "from 0 to 1, one mechanism at a time" — mirroring learn.shareai.run.
 */
export function architectPrompt(ctx: RepoContext, targetLessonCount: number): string {
  const fileList = ctx.tree.slice(0, 400).join("\n");
  const keyFiles = ctx.keyFiles
    .map((f) => `### ${f.path} (${f.role})\n\`\`\`\n${f.excerpt}\n\`\`\``)
    .join("\n\n");

  return `You are a senior engineering educator. Your job is to turn a real code repository into a **layered, progressive tutorial** in the spirit of "learn.shareai.run" — teaching the project from 0 to 1, one mechanism at a time, each lesson building on the previous.

You are running INSIDE the repository at "${ctx.localPath}". You may read any file. You may search the web for official docs, background concepts, and best practices to inform your plan (cite nothing yet — that happens per-lesson).

REPO: ${ctx.name} (${ctx.url})
SHA: ${ctx.sha} · ~${ctx.loc} LOC · languages: ${Object.entries(ctx.languages).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ")}

SUMMARY:
zh: ${ctx.summary.zh}
en: ${ctx.summary.en}

FILE TREE (truncated):
${fileList}

KEY FILES:
${keyFiles}

TASK
1. Understand what this project does and the core problem it solves.
2. Design an ordered list of ${targetLessonCount} (±2) lessons that go from beginner-friendly foundations to the most advanced/inner mechanisms. Each lesson teaches ONE concept. Order them so a learner could read top-to-bottom and build up understanding incrementally (s01 → sN).
3. For each lesson, pick the REAL files (from the tree above) that the lesson should quote.

Return STRICT JSON ONLY (no prose, no markdown fences) with this exact shape:

{
  "course": {
    "title": { "zh": "...", "en": "..." },
    "tagline": { "zh": "...", "en": "..." },
    "repo": { "url": "${ctx.url}", "name": "${ctx.name}", "sha": "${ctx.sha}" }
  },
  "lessons": [
    {
      "id": "s01",
      "title": { "zh": "...", "en": "..." },
      "difficulty": "beginner" | "intermediate" | "advanced",
      "theProblem": { "zh": "one-line pain point this lesson resolves", "en": "..." },
      "objective": { "zh": "what the learner can do after", "en": "..." },
      "keyFiles": ["path/from/tree.ts"],
      "prereq": [],
      "tags": ["tool-use"]
    }
  ]
}

Rules:
- ids are "s01", "s02", ... zero-padded, strictly increasing, starting at s01.
- prereq contains only earlier lesson ids.
- keyFiles must be real paths from the file tree.
- Both zh and en must be filled for every field. zh is Simplified Chinese.
- Output ONLY the JSON object.`;
}
