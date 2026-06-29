import type { Locale } from "./types";

export type CodexAssistantMode = "explain" | "translate" | "example" | "followup" | "summarize" | "quiz";

export interface CodexAssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CodexAssistantContext {
  repoId?: string;
  locale: Locale;
  courseTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  sectionTitle?: string;
  selectionText: string;
  selectionKind: string;
  surroundingText?: string;
  codeFile?: string;
  codeLanguage?: string;
  activeStep?: string;
}

export interface CodexAssistantRequest {
  question: string;
  mode: CodexAssistantMode;
  context: CodexAssistantContext;
  history: CodexAssistantTurn[];
}

export interface CodexAssistantResponse {
  answer: string;
  summary: string;
  highlights: string[];
  followUps: string[];
  references: { label: string; href?: string | null }[];
  provider?: string;
}

export function localTeacherAnswer(request: CodexAssistantRequest): CodexAssistantResponse {
  const ctx = request.context;
  const selected = clip(ctx.selectionText.trim(), 360);
  const target = selected || clip(ctx.lessonTitle || ctx.courseTitle || "当前内容", 120);
  const location = [ctx.lessonId, ctx.lessonTitle].filter(Boolean).join(" ") || ctx.courseTitle || "当前课程";
  const kind = ctx.selectionKind === "code" ? "这段代码" : "这段内容";
  const answer =
    request.mode === "translate"
      ? `先说结论：${kind}可以理解为「${target}」。\n\n白话解释：它出现在 ${location} 里，作用是帮助你把抽象概念落到具体机制上。下一步建议追问它和本节目标之间的关系。`
      : request.mode === "example"
        ? `先说结论：${target} 的关键是先抓住它解决的问题。\n\n举个例子：如果课程在讲 agent 循环，一行判断语句往往是在决定模型是继续调用工具，还是结束任务。\n\n下一步：你可以继续问“这段在真实项目里会怎么写”。`
        : request.mode === "quiz"
          ? `小练习：请用一句话说明 ${target} 在本节中的作用。\n\n参考答案：它把一个抽象机制落到可观察的行为上，让你能判断系统为什么会这样运行。`
          : request.mode === "summarize"
            ? `先说结论：${location} 的核心不是记住所有细节，而是抓住它新增的那个机制。\n\n学习时按三步看：它解决什么问题、它怎么工作、它和真实源码有什么差别。`
            : `先说结论：${target} 是 ${location} 中需要重点理解的学习点。\n\n为什么：它不是孤立片段，而是在当前 lesson 里承担解释机制的作用。要把它和本节的问题、解决方案、代码步骤放在一起看。\n\n例子：如果选中的是代码，先问它的输入、输出和副作用；如果选中的是概念，先问它解决了什么问题。\n\n下一步：可以继续让我从初学者角度重讲一遍，或结合真实源码解释。`;

  return {
    answer,
    summary: clip(target, 80),
    highlights: ["先定位它在本节里的作用", "再看它解决的问题", "最后和代码或源码对照"],
    followUps:
      ctx.selectionKind === "code"
        ? ["逐行解释这段代码", "真实项目里为什么要这样写？", "给一个更小的例子"]
        : ["用更白话的方式再讲一遍", "给一个具体例子", "这和本节目标有什么关系？"],
    references: [{ label: location }],
    provider: "local",
  };
}

function clip(value: string, limit: number): string {
  const text = value.trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

