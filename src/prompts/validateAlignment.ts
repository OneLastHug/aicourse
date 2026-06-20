import type { RepoContext } from "../types";

/** Validation Round 2 — check the tutorial against the ACTUAL repo (agent runs inside the repo). */
export function validateAlignmentPrompt(ctx: RepoContext, courseJson: string): string {
  return `You are inside the repo at "${ctx.localPath}". Verify the tutorial against the ACTUAL code.
For each lesson: open the files it cites and check that (a) quoted snippets match the real file contents, (b) function/class/path/symbol names are real, (c) explanations are consistent with what the code actually does. Flag any mismatch or fabricated reference.

Return STRICT JSON ONLY:
{
  "passed": <true only if the tutorial is faithful to the real code>,
  "issues": [
    {"severity":"error"|"warning","lessonId":"<id>","problem":"<claim vs reality>","fix":"<concrete fix>"}
  ],
  "summary": "<2 sentences>"
}
JSON only.

TUTORIAL (JSON):
${courseJson}`;
}
