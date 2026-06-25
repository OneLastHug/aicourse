import type { RepoContext } from "../types";

/** Stage 1 — a deep technical read of the REAL repository. The agent runs inside
 * the repo and must actually open files (no pre-filtered excerpts). Output: JSON
 * architectural analysis (in Simplified Chinese) used to design the layered curriculum. */
export function analyzePrompt(ctx: RepoContext): string {
  const fileList = ctx.tree.slice(0, 800).join("\n");
  const langs = Object.entries(ctx.languages).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ");
  return `你是资深工程师，正在对一个真实仓库做深度技术精读，为分层教程做准备。你运行在仓库内 "${ctx.localPath}"。

用工具实际打开并阅读源码——不要凭文件名猜。可在网上查这个项目是什么、生态与官方文档。

REPO: ${ctx.name} (${ctx.url}) · ${ctx.sha} · ~${ctx.loc} LOC · ${langs}

FILE TREE:
${fileList}

任务：充分探索代码库，返回 STRICT JSON ONLY。所有文本值用简体中文，极其精炼，禁套话/客套/无信息量句子。

STYLE — 精炼是第一要求：
- 每条是一句话，去掉"我们可以看到""值得注意的是""总而言之"等废话。
- summary 不超过 3 句，直说"它是什么、解决什么问题"。
- coreMechanisms 是真正需要学习者掌握的机制，按依赖排序、由易到难，每个 4-10 字（如"模型↔工具的循环"）。
- 中英混排要自然：开发者习惯说英文的术语就保留英文（token、prompt、agent、hook、commit、API、SDK、CLI、tool_use 等），别硬译成生僻中文（不要把 token 写成「词元」、hook 写成「钩子」）；已约定俗成的词正常用中文（循环、上下文、缓存、回调、权限）。
- gotchas 只写非显而易见、影响理解的点。

{
  "summary": "<2-3 句：项目是什么、为何存在>",
  "coreMechanisms": ["<关键机制，4-10 字，按依赖排序>"],
  "architecture": "<各部分如何配合：模块、数据/控制流、入口、核心设计决策，3-5 句>",
  "layeredTeachingPath": ["<层次主题，2-5 字，由易到难>"],
  "spineLanguage": "<整套教学 spine 代码统一使用的语言，取仓库主语言；不适合则 python>",
  "runningExampleSpine": ["<增量蓝图：每节一个机制、后一节是前一节的超集，如 's01: 最小循环'>"],
  "archDiagram": { "kind": "mermaid", "caption": "<中文标题>", "diagram": "<Mermaid 总架构图文本>" },
  "gotchas": ["<非显而易见、影响教学的点>"]
}

archDiagram 约束：只画真实存在的模块/数据流（基于你读过的文件）；用 flowchart TD 或 LR；每个节点标签用双引号包裹（如 loop["loop.ts 循环"]）；不要在标签外裸用 () : 等特殊字符。
每条结论都要基于你实际读过的文件；引用真实路径/符号。JSON only，中文值，精炼。`;
}
