import type { ZhOutlineLesson, RepoContext } from "../types";

/** Stage 3a — read the lesson's real files in full; output mechanism understanding + exact code refs (in Chinese). */
export function lessonReadPrompt(ctx: RepoContext, lesson: ZhOutlineLesson, allTitles: string): string {
  return `You are inside the repo at "${ctx.localPath}". For THIS lesson, READ the listed files IN FULL with your tools (plus any others you need) to understand the mechanism precisely.

LESSON: ${lesson.id} — ${lesson.title} (${lesson.difficulty})
Mechanism to teach: ${lesson.mechanism}
Problem: ${lesson.theProblem}
Objective: ${lesson.objective}
FILES TO READ (read fully): ${lesson.filesToRead.join(", ")}

OTHER LESSONS (for context; do not duplicate):
${allTitles}

Return STRICT JSON ONLY. ALL text VALUES in Simplified Chinese (keep file/symbol names as-is):
{
  "mechanism": "<该机制在本代码库中究竟如何运作，基于你读到的代码>",
  "codeRefs": [{"file":"real/path","symbol":"<函数/类等>","lines":"<a-b>","why":"<为何这是本课关键>"}],
  "insights": ["<值得教学的非显而易见的点>"],
  "beforeAfter": "<若有 before/after 对比有教学意义则描述，否则为空>"
}
Ground everything in files you actually opened. JSON only, Chinese values.`;
}
