import type { RepoContext } from "../types";

/** Round 2 per-lesson: check ONE lesson against the ACTUAL repo code. */
export function validateLessonAlignmentPrompt(ctx: RepoContext, lessonId: string, lessonJson: string): string {
  return `You are inside the repo at "${ctx.localPath}". Verify this ONE lesson against the ACTUAL code.
Open the files it cites and check: (a) quoted snippets match real file contents, (b) function/class/path names are real, (c) explanations are consistent with the code.

Lesson ${lessonId} (JSON):
${lessonJson}

Return STRICT JSON ONLY:
{ "passed": <true only if faithful to the real code>, "issues": [{"severity":"error"|"warning","lessonId":"${lessonId}","problem":"<claim vs reality>","fix":"..."}], "summary": "<1 sentence>" }
JSON only.`;
}
