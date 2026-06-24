import type { RepoContext, SpineArtifact, ZhOutlineLesson } from "../types";

/** Spine stage — materialize this lesson's runnable teaching-code snapshot.
 *  Each snapshot = the previous lesson's code + this one mechanism (a superset),
 *  in the repo's primary language (learn.shareai.run's sNN/code.<ext> style). */
export function spinePrompt(ctx: RepoContext, lesson: ZhOutlineLesson, prev: SpineArtifact | undefined, analysis: string): string {
  const prevBlock = prev
    ? `上一节（${prev.lessonId}）的完整代码（path: ${prev.path}，language: ${prev.language}）：
\`\`\`
${prev.code}
\`\`\``
    : "这是第一节：没有上一节代码，从零写一个最小可运行的起点。";
  return `你在为真实仓库 "${ctx.name}" 构建一套"逐课生长的最小可运行教学代码"（learn.shareai.run 的 sNN/code 风格）。你运行在仓库内 "${ctx.localPath}"，可参考真实源码，但产出的是简化的教学版。

本节：${lesson.id} — ${lesson.title}
本节唯一机制：${lesson.mechanism}
可参考的真实文件：${(lesson.filesToRead ?? []).join(", ") || "（自行在仓库中定位相关实现）"}

${prevBlock}

仓库分析（含主语言与 spine 蓝图）：
${analysis}

硬性要求（逐条遵守）：
1. 超集：输出"完整文件"（不是 diff）。必须保留上一节的全部能力，只新增实现本节机制（${lesson.mechanism}）所需的最小改动。
2. 可运行：单文件、最小依赖；不依赖真实 API key 才能跑——外部服务（如 LLM 调用）用本地可替换的 stub/假实现。给出 runCmd。
3. 忠实但简化：参考真实仓库该机制的实现以保证方向正确，但删繁就简到教学可读（几十行级、≤200 行）。这是教学化简化版，不是照抄源码。
4. 语言一致：整套 spine 用同一种语言（见分析里的主语言）；不要中途换语言。${prev ? `沿用上一节的语言 ${prev.language}。` : ""}
5. addedLines：标出相对上一节"新增/改动"的行号（第一节为空数组）。
6. path 用 "sNN_<英文slug>/code.<ext>" 风格，sNN 用本节 id（${lesson.id}）。

返回 STRICT JSON ONLY（RFC 8259，以 '{' 开头、'}' 结尾；code 内换行写 \\n、双引号写 \\"、反斜杠写 \\\\；无注释、无尾逗号、无 markdown 围栏、无 JSON 前后文字）：
{
  "lessonId": "${lesson.id}",
  "path": "sNN_xxx/code.ext",
  "language": "...",
  "code": "<本节完整可运行代码>",
  "runCmd": "<如何运行，如 'npx tsx s01_xxx/code.ts'>",
  "addedLines": [],
  "prevLessonId": ${prev ? `"${prev.lessonId}"` : "null"}
}
JSON only。`;
}
