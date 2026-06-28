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
- 课分成 SECTIONS（层），每层一个连贯主题。3-5 层。
- 每层 2-4 节；总课时约 ${target} 节；层间由 beginner→advanced。
- 每节只讲一个机制，并推进运行示例 spine。
- filesToRead 必须是真实仓库路径（课程 agent 会逐字读）。
- 排序使每节只依赖更早的节（prereq = 更早的 lesson id）。
- 不是生成一组知识点，而是生成一条有明确递进理由的学习路径：每节都要解释为什么现在讲、上一节还缺什么、这一节之后又暴露出什么问题。

STYLE — 标题与措辞（极重要，模仿 learn.shareai.run）：
- 课程 title：2-5 字的名词短语，不要句子。
- tagline：一句短促有力的口号（≤12 字），不要解释性长句。
- thesis：贯穿全课的思想主线金句（≤24 字）。
- spine：一句话说清课程运行示例如何逐节生长。
- audience：一句话说清读者画像。
- whyThisOrder：一句话说清为什么按这个顺序讲。
- section.title：2-4 字主题；summary 一句话。
- section.role：这一层在整门课里的职责。
- section.transitionIn：为什么从上一层进入这一层。
- section.transitionOut：为什么下一层会自然出现。
- lesson.title：1-4 字的机制名，严禁整句当标题。
- theProblem：用具体场景/痛点一两句说清"没有它会怎样"，不要复述标题。
- objective：一句，说清学完能做什么。
- mechanism：4-10 字点明这一节的核心机制。
- whyNow：为什么这一节必须现在讲。
- missingBefore：上一节结束后还缺什么。
- nextPressure：这一节讲完后，会自然暴露出什么下一节才解决的问题。
- 中英混排要自然：开发者口头常用英文术语就保留英文，如 token、prompt、agent、hook、commit、merge、API、SDK、CLI、tool_use、payload。

返回 STRICT JSON ONLY，所有面向用户的文本用中文（id/difficulty/repo/paths 保持原样）。若 ANALYSIS 含 archDiagram，原样复制到顶层 archDiagram（mermaid 文本一字不改）：
{
  "course": {
    "title": "...",
    "tagline": "...",
    "thesis": "...",
    "spine": "...",
    "audience": "...",
    "whyThisOrder": "...",
    "repo": {"url":"${ctx.url}","name":"${ctx.name}","sha":"${ctx.sha}"}
  },
  "archDiagram": { "kind": "mermaid", "caption": "<中文标题>", "diagram": "<从 ANALYSIS 原样复制的 mermaid 文本>" },
  "sections": [
    {
      "id": "l01",
      "title": "...",
      "summary": "...",
      "spine": "<本层如何推进 spine>",
      "role": "...",
      "transitionIn": "...",
      "transitionOut": "...",
      "lessons": [
        {
          "id": "s01",
          "title": "...",
          "difficulty": "beginner|intermediate|advanced",
          "theProblem": "<痛点>",
          "objective": "<学完能做什么>",
          "mechanism": "<单一机制>",
          "whyNow": "...",
          "missingBefore": "...",
          "nextPressure": "...",
          "filesToRead": ["real/paths"],
          "prereq": [],
          "tags": []
        }
      ]
    }
  ]
}
JSON only，中文值，精炼。`;
}
