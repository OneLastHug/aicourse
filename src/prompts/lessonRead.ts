import type { ZhOutlineLesson, RepoContext } from "../types";

/** Stage 3a — read the lesson's real files in full; output mechanism understanding + exact code refs (in Chinese). */
export function lessonReadPrompt(ctx: RepoContext, lesson: ZhOutlineLesson, allTitles: string): string {
  return `你在仓库内 "${ctx.localPath}"。为这一节，用工具把列出的文件逐字读完（外加你需要的其它文件），精确理解这一机制。

LESSON: ${lesson.id} — ${lesson.title} (${lesson.difficulty})
要教的机制: ${lesson.mechanism}
问题: ${lesson.theProblem}
目标: ${lesson.objective}
要读的文件（逐字读）: ${lesson.filesToRead.join(", ")}

其它课程（供参考，勿重复）:
${allTitles}

返回 STRICT JSON ONLY，所有文本用简体中文，极其精炼、禁套话：
{
  "mechanism": "<该机制在本代码库中究竟如何运作，2-4 句，基于读到的代码>",
  "codeRefs": [{"file":"real/path","symbol":"<函数/类等>","lines":"<a-b>","why":"<为何这是本节关键，一句话>"}],
  "insights": ["<非显而易见、值得教的点，每条一句>"],
  "beforeAfter": "<若有 before/after 对比有教学意义则简述，否则空>"
}
每条都要基于你实际打开过的文件。JSON only，中文值，精炼。`;
}
