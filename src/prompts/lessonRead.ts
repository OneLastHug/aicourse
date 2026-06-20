import type { EnOutlineLesson, RepoContext } from "../types";

/** Stage 3a — read the lesson's real files in full; output mechanism understanding + exact code refs. */
export function lessonReadPrompt(ctx: RepoContext, lesson: EnOutlineLesson, allTitles: string): string {
  return `You are inside the repo at "${ctx.localPath}". For THIS lesson, READ the listed files IN FULL with your tools (plus any others you need) to understand the mechanism precisely.

LESSON: ${lesson.id} — ${lesson.title} (${lesson.difficulty})
Mechanism to teach: ${lesson.mechanism}
Problem: ${lesson.theProblem}
Objective: ${lesson.objective}
FILES TO READ (read fully): ${lesson.filesToRead.join(", ")}

OTHER LESSONS (for context; do not duplicate):
${allTitles}

Return STRICT JSON ONLY:
{
  "mechanism": "<how this mechanism actually works in THIS codebase, grounded in what you read>",
  "codeRefs": [{"file":"real/path","symbol":"<function/class/etc>","lines":"<a-b>","why":"<why this is the crux of the lesson>"}],
  "insights": ["<non-obvious points worth teaching>"],
  "beforeAfter": "<if a before/after contrast is instructive, describe it; else empty>"
}
Ground everything in files you actually opened. JSON only.`;
}
