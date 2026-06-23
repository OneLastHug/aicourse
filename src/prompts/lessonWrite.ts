import type { ZhOutlineLesson } from "../types";

/** Stage 3b — write the rich CHINESE lesson body using the read result.
 *  Mirrors learn.shareai.run: 问题 / 解决方案 / 工作原理(分步) / 深入 / 试一下 / 对比. */
export function lessonWritePrompt(lesson: ZhOutlineLesson, readResult: string): string {
  return `写分层教程的某一节（learn.shareai.run 水准）——用简体中文。用项目真实代码逐行讲清这一个机制。

LESSON: ${lesson.id} — ${lesson.title}
READ RESULT（从真实代码里读到的）:
${readResult}

文风与结构（极重要，逐项遵守）：
- 总原则：精炼、口语、有信息量。禁套话/客套/无信息量句子（"我们可以看到""值得注意的是""在本节中我们将探讨""综上所述"全部删除）。
- problem：用具体场景说"没有它会怎样"或痛点直觉，2-4 句，不复述标题。
- solution：一句话点破核心思路（≤30 字），让人秒懂"原来如此"。
- howItWorks：4-7 步，每步标题是 2-6 字短语（如"调用模型""判断结束"），不是句子；desc 一两句解释该步；每步配**核心代码片段**（只摘 5-20 行最关键的函数/表达式，**不要放整个文件**），关键行号放 highlightLines。代码里**插入注释讲解**——在关键行上方或旁边用 # 或 // 注释解释该行做什么，注释每行不超过 40 字符要换行。如果同一机制有多种语言实现可选展示。可用 anatomy 做逐行注解，用 beforeCode 做 before/after。
- deepDive：讲"为什么这样设计/权衡/被否决的替代方案/历史/性能或安全"，但必须**分点或分段有结构**，不要一大段流水账；引用权威网页（title+url）。
- tryIt：几条可运行的命令或提示词，每条一行（\\n 分隔），让人能上手试。
- compare：一张表，把本方案 vs 朴素/显然方案对比，rows 的 a/b 是短语不是长句。

单点深度：这一节只深挖这一个机制；不跑题、不重复其它节。但要把它讲透（不止"是什么"，还要"为什么、边界、坑"）。

返回 STRICT JSON ONLY。problem/solution/howItWorks(标题+描述+解剖)/deepDive/tryIt/compare(label+a+b) 用中文；code、文件路径、ids、language、highlightLines、references 的 title+url 保持原样：
{
  "id": "${lesson.id}",
  "problem": "...",
  "solution": "...",
  "howItWorks": [
    { "title": "...", "desc": "...", "code": {"file":"real/path","language":"ts","snippet":"<real code>","highlightLines":[3,4]},
      "anatomy": "<optional 逐行注解>", "beforeCode": {"file":"...","language":"...","snippet":"...","highlightLines":[]} }
  ],
  "deepDive": "...",
  "tryIt": "命令1\\n命令2\\n命令3",
  "references": [{"title":"...","url":"https://..."}],
  "compare": {"rows":[{"label":"...","a":"朴素做法","b":"本节方案"}]},
  "loc": 0,
  "filesUsed": ["real/path"]
}
输出 RFC 8259 JSON ONLY——以 '{' 开头、'}' 结尾。所有 key 和 string 用双引号；"snippet" 内换行写 \\n、双引号写 \\"、反斜杠写 \\\\。无单引号、无注释、无尾逗号、无 markdown 围栏、无 JSON 前后文字。JSON only，中文，精炼有结构。`;
}
