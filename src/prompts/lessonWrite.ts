import type { Repo2LearnConfig, SpineArtifact, ZhOutlineLesson } from "../types";

/** Stage 3b — write the rich CHINESE lesson body using the read result + (optional)
 *  the runnable spine snapshot. */
export function lessonWritePrompt(lesson: ZhOutlineLesson, readResult: string, cfg: Repo2LearnConfig, spine?: SpineArtifact): string {
  const spineBlock = spine
    ? `本节的"教学 spine"可运行代码（path: ${spine.path}，language: ${spine.language}）——howItWorks 主体就讲它：
\`\`\`
${spine.code}
\`\`\``
    : `（本节没有 spine 代码：直接用真实仓库源码来讲，howItWorks 的 code 省略 isSpine 字段。）`;

  const researchBlock = cfg.research.enabled && cfg.research.mode === "limited"
    ? `允许做**有限联网**补充背景资料，但必须遵守：
- 本地 repo 代码事实优先于一切外部资料。
- 联网只用于补：官方文档 / RFC / 论文 / 权威工程博客里的术语、历史背景、设计动机。
- 优先来源类型：official > spec > paper > blog；最多引用 ${cfg.research.maxReferencesPerLesson} 条。
- 禁止 SEO 农场文、AI 洗稿、聚合站、论坛二手转述。
- 禁止把外部资料里的 API/实现硬套到本 repo 上。
- 禁止任何有副作用的联网行为：不登录、不下载执行脚本、不改系统配置。`
    : `默认离线写作：只以本地 repo 与已读内容为准；references 只能引用你确信权威且与本节机制直接相关的资料。`;

  return `写分层教程的某一节（learn.shareai.run 水准）——用简体中文。${spine ? "用本节的教学 spine 代码逐行讲清这一个机制，最后对照真实仓库源码。" : "用项目真实代码逐行讲清这一个机制。"}

LESSON: ${lesson.id} — ${lesson.title}
机制：${lesson.mechanism}
为什么现在讲：${lesson.whyNow ?? ""}
上一节还缺：${lesson.missingBefore ?? ""}
下一节压力：${lesson.nextPressure ?? ""}
真实文件：${(lesson.filesToRead ?? []).join(", ") || "（READ RESULT 里有）"}
READ RESULT（从真实代码里读到的）:
${readResult}

${spineBlock}

${researchBlock}

文风与结构（极重要，逐项遵守）：
- 总原则：精炼、口语、有信息量。禁套话/客套/无信息量句子。
- 中英混排自然，开发者口头常用英文术语就保留英文。
- principle：本节金句，一句话点破原理（≤20 字）。
- teachingScope：一句话说清本节刻意只讲什么、不讲什么。
- problem：用具体场景说"没有它会怎样"，2-4 句，不复述标题。
- solution：一句话点破核心思路（≤30 字）。
- diagram：一张 Mermaid 图描绘本节机制。
- howItWorks：5-8 步，每步标题是 2-6 字短语，不是句子；desc 要解释这一步做了什么、为什么必须先做、拿掉会怎样。${spine ? "主体步骤讲 spine 代码；最后追加一步「对照真实源码」。" : "每步配真实代码。"}
- deepDive：讲设计与权衡（约 250-450 字），必须包含：为什么这么设计、取舍与被否决方案、边界与坑。
- deepSource：带读者看真实仓库里这个机制怎么实现，约 250-500 字 markdown。
- sourceCompare：结构化产出教学版 vs 真实实现的差异，至少 3 条 gaps。每条 gap 要有 dimension / simplified / real / whySimplified。
- tryIt：改成结构化实验：setup（可选）、commands、observe。commands 是可运行命令/提示词；observe 是你希望读者观察到的现象，而不是"运行成功"。
- whatsNext：1-3 句，明确说这一节解决了什么、又暴露了什么，因此下一节为什么存在。
- compare：一张表，把本方案 vs 朴素/显然方案对比，rows 的 a/b 是短语不是长句。
- references：0-${cfg.research.maxReferencesPerLesson} 条；每条包含 title/url/kind/whyUsed。只有确实提升本节深度时才引用。
- badges：{ loc, difficulty, concepts }。

单点深度：这一节只深挖这一个机制；不跑题、不重复其它节，但要讲透（不止"是什么"，还要"为什么、边界、坑"）。

返回 STRICT JSON ONLY。面向用户的文本字段用中文；code、文件路径、ids、language、highlightLines、isSpine、symbol、diagram.diagram、references.title/url/kind、badges.concepts 保持原样：
{
  "id": "${lesson.id}",
  "principle": "...",
  "teachingScope": "...",
  "problem": "...",
  "solution": "...",
  "diagram": {"kind":"mermaid","caption":"...","diagram":"flowchart TD\\n  A[\\"...\\"] --> B[\\"...\\"]"},
  "howItWorks": [
    { "title": "...", "desc": "...", "code": {"file":"${spine ? spine.path : "real/path"}","language":"${spine ? spine.language : "ts"}","snippet":"<code>","highlightLines":[1]${spine ? ',"isSpine":true' : ""}}, "anatomy": "<optional>" }
  ],
  "deepDive": "## 为什么这么设计\\n...\\n\\n## 取舍\\n...\\n\\n## 边界与坑\\n...",
  "deepSource": "...",
  "sourceCompare": {
    "simplified": "教学版",
    "real": "真实实现",
    "gaps": [
      {"dimension":"错误处理","simplified":"省略","real":"重试+降级","whySimplified":"先讲主干"}
    ]
  },
  "tryIt": {
    "setup": ["..."],
    "commands": ["命令1", "命令2"],
    "observe": ["观察现象1", "观察现象2"]
  },
  "whatsNext": "...",
  "references": [{"title":"...","url":"https://...","kind":"official","whyUsed":"补充设计动机"}],
  "compare": {"rows":[{"label":"...","a":"朴素做法","b":"本节方案"}]},
  "badges": {"loc":0,"difficulty":"${lesson.difficulty}","concepts":["..."]},
  "loc": 0,
  "filesUsed": ["real/path"]
}
输出 RFC 8259 JSON ONLY——以 '{' 开头、'}' 结尾。`;
}
