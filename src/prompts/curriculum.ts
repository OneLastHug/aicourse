import type { RepoContext } from "../types";

/** Stage 2 — design a LAYERED curriculum (sections × lessons) from the analysis.
 *  Sections are coherent themes; lessons within advance a running example spine.
 *  Output is in Simplified Chinese (the primary generation language). */
export function curriculumPrompt(ctx: RepoContext, analysis: string, target: number): string {
  return `你是课程架构师。把仓库分析转成一套分层教程（learn.shareai.run 风格：分层，从 0 到 1 逐机制构建）。

REPO: ${ctx.name}
ANALYSIS（来自对真实代码的精读）:
${analysis}

设计规则：
- 课分成 SECTIONS（层），每层一个连贯主题（如"基础""核心引擎""进阶"）。3-5 层。
- 每层 2-4 节；约 ${target} 节；层间由 beginner→advanced。
- 每节只讲一个机制，并推进运行示例 spine。
- filesToRead 必须是真实仓库路径（课程 agent 会逐字读）。
- 排序使每节只依赖更早的节（prereq = 更早的 lesson id）。

STYLE — 标题与措辞（极重要，模仿 learn.shareai.run）：
- 课程 title：2-5 字的名词短语，不要句子（如"构建迷你 Agent"，不是"从零开始一步步构建一个迷你编程 Agent 的完整指南"）。
- tagline：一句短促有力的口号（≤12 字，如"一次只讲一个机制"），不要解释性长句。
- section.title：2-4 字主题（如"基础""核心""进阶"）；summary 一句话。
- lesson.title：1-4 字的机制名（如"Agent 循环""工具调用""权限系统"），严禁整句当标题。
- theProblem：用具体场景/痛点一两句说清"没有它会怎样"，不要复述标题。
- objective：一句，说清学完能做什么。
- mechanism：4-10 字点明这一节的核心机制。

返回 STRICT JSON ONLY，所有面向用户的文本用中文（id/difficulty/repo/paths 保持原样）：
{
  "course": { "title": "...", "tagline": "...", "repo": {"url":"${ctx.url}","name":"${ctx.name}","sha":"${ctx.sha}"}, "spine": "<随每节生长的运行示例>" },
  "sections": [
    { "id": "l01", "title": "...", "summary": "...", "spine": "<本层如何推进 spine>",
      "lessons": [
        { "id": "s01", "title": "...", "difficulty": "beginner|intermediate|advanced",
          "theProblem": "<痛点>", "objective": "<学完能做什么>", "mechanism": "<单一机制>", "filesToRead": ["real/paths"], "prereq": [], "tags": [] }
      ]
    }
  ]
}
JSON only，中文值，精炼。`;
}
