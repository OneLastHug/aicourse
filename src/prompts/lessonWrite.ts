import type { SpineArtifact, ZhOutlineLesson } from "../types";

/** Stage 3b — write the rich CHINESE lesson body using the read result + (optional)
 *  the runnable spine snapshot. Mirrors learn.shareai.run: 金句 / 问题 / 解决方案 /
 *  机制图 / 工作原理(分步, 讲 spine + 对照真实源码) / 深入 / 试一下 / 对比 / 徽章. */
export function lessonWritePrompt(lesson: ZhOutlineLesson, readResult: string, spine?: SpineArtifact): string {
  const spineBlock = spine
    ? `本节的"教学 spine"可运行代码（path: ${spine.path}，language: ${spine.language}）——howItWorks 主体就讲它：
\`\`\`
${spine.code}
\`\`\``
    : `（本节没有 spine 代码：直接用真实仓库源码来讲，howItWorks 的 code 省略 isSpine 字段。）`;
  return `写分层教程的某一节（learn.shareai.run 水准）——用简体中文。${spine ? "用本节的教学 spine 代码逐行讲清这一个机制，最后对照真实仓库源码。" : "用项目真实代码逐行讲清这一个机制。"}

LESSON: ${lesson.id} — ${lesson.title}
机制：${lesson.mechanism}
真实文件：${(lesson.filesToRead ?? []).join(", ") || "（READ RESULT 里有）"}
READ RESULT（从真实代码里读到的）:
${readResult}

${spineBlock}

文风与结构（极重要，逐项遵守）：
- 总原则：精炼、口语、有信息量。禁套话/客套/无信息量句子（"我们可以看到""值得注意的是""在本节中我们将探讨""综上所述"全部删除）。
- 中英混排要自然（像国内资深工程师写技术博客）：开发者习惯说英文的术语就保留英文——token、prompt、agent、hook、commit、merge、API、SDK、CLI、tool_use、payload、callback、context 等按口语习惯保留英文，别硬译成生僻中文（不要把 token 写成「词元」、hook 写成「钩子」、payload 写成「有效载荷」）；已约定俗成的词正常用中文（循环、上下文、缓存、权限、并发）。判断标准：你怎么跟同事口头讲，就怎么写。
- principle：本节金句，一句话点破原理（≤20 字），像能记住、能引用的一句话。
- problem：用具体场景说"没有它会怎样"或痛点直觉，2-4 句，不复述标题。
- solution：一句话点破核心思路（≤30 字），让人秒懂"原来如此"。
- diagram：一张 Mermaid 图描绘本节机制（数据流/状态/结构）。约束：flowchart 方向用 TD 或 LR；每个节点标签用双引号包裹（如 A["调用模型"]）；不要在标签外裸用 () : 等特殊字符；产出真实、能解析的 mermaid 文本。
- howItWorks：5-8 步，每步标题是 2-6 字短语（如"调用模型""判断结束"），不是句子；desc 一两句解释该步。${spine ? "主体步骤讲 spine 代码（code.file 用 spine 的 path，code.isSpine=true，snippet 引 spine 代码片段，关键行号放 highlightLines）；最后追加一步「对照真实源码」（code.isSpine=false，code.file 用真实仓库路径，code.symbol 填真实函数/类名，desc 说清真实实现比 spine 多了哪些工程细节）。" : "每步配真实代码（quote 整个函数/表达式，关键行号放 highlightLines）。可用 anatomy 做逐行注解，用 beforeCode 做 before/after。"}
- deepDive：讲设计与权衡（约 250-450 字），用 markdown 分 2-3 个 \`## 小标题\`：① **为什么这么设计**（动机、比朴素做法好在哪）；② **取舍与被否决的替代方案**；③ **边界与坑**。允许 \`**强调**\`、\`- 列点\`、\`\`\`行内代码\`\`\`。引用 2+ 权威网页放进 references。
- deepSource（深入源码，**本节深度的重头戏**）：带读者看真实仓库里这个机制到底怎么实现，约 250-500 字 markdown。必须包含：① 一段点明真实实现的关键文件/函数与控制流（引真实路径/符号）；② **至少 1 张 markdown 对照表** \`| 维度 | ${spine ? "教学 spine" : "教学版"} | 真实实现 |\`，逐行点出真实实现多出的机制（错误处理、并发、权限、边界、配置等）；③ 每条简化补一句"为什么这么简化对教学是合理的"。表格单元格要短。若实在没有真实源码可对照，可省略本字段。
- tryIt：几条可运行的命令或提示词，每条一行（\\n 分隔）。${spine?.runCmd ? `第一条可用 spine 的运行命令：${spine.runCmd}。` : ""}
- compare：一张表，把本方案 vs 朴素/显然方案对比，rows 的 a/b 是短语不是长句。
- badges：{ loc: ${spine ? "本节 spine 代码行数" : "本节涉及代码行数"}, difficulty: "${lesson.difficulty}", concepts: [2-4 个英文/技术概念标签] }。

单点深度：这一节只深挖这一个机制；不跑题、不重复其它节，但要讲透（不止"是什么"，还要"为什么、边界、坑"）。

返回 STRICT JSON ONLY。principle/problem/solution、howItWorks 的 title+desc+anatomy、deepDive/deepSource/tryIt、compare 的 label、diagram.caption 用中文；code、文件路径、ids、language、highlightLines、isSpine、symbol、diagram.diagram(mermaid 文本)、references 的 title+url、badges.concepts 保持原样：
{
  "id": "${lesson.id}",
  "principle": "...",
  "problem": "...",
  "solution": "...",
  "diagram": {"kind":"mermaid","caption":"...","diagram":"flowchart TD\\n  A[\\"...\\"] --> B[\\"...\\"]"},
  "howItWorks": [
    { "title": "...", "desc": "...", "code": {"file":"${spine ? spine.path : "real/path"}","language":"${spine ? spine.language : "ts"}","snippet":"<code>","highlightLines":[1]${spine ? ',"isSpine":true' : ""}}, "anatomy": "<optional>" }${spine ? `,
    { "title": "对照真实源码", "desc": "...", "code": {"file":"real/path","language":"ts","snippet":"<real code>","highlightLines":[1],"isSpine":false,"symbol":"realFn"} }` : ""}
  ],
  "deepDive": "## 为什么这么设计\\n...\\n\\n## 取舍\\n...\\n\\n## 边界与坑\\n...",
  "deepSource": "真实实现见 \`real/path\` 的 \`realFn\`：...\\n\\n| 维度 | 教学版 | 真实实现 |\\n| --- | --- | --- |\\n| 错误处理 | 省略 | 重试+降级 |",
  "tryIt": "命令1\\n命令2",
  "references": [{"title":"...","url":"https://..."}],
  "compare": {"rows":[{"label":"...","a":"朴素做法","b":"本节方案"}]},
  "badges": {"loc":0,"difficulty":"${lesson.difficulty}","concepts":["..."]},
  "loc": 0,
  "filesUsed": ["real/path"]
}
输出 RFC 8259 JSON ONLY——以 '{' 开头、'}' 结尾。所有 key 和 string 用双引号；"snippet" 与 "diagram" 内换行写 \\n、双引号写 \\"、反斜杠写 \\\\。无单引号、无注释、无尾逗号、无 markdown 围栏、无 JSON 前后文字。JSON only，中文，精炼有结构。`;
}
