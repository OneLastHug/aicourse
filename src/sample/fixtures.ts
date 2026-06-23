/**
 * v2 mock sample data (compact) — used by the offline `--sample` mode so the full
 * v2 pipeline (Chinese-first: analyze→curriculum→lessons→validate×2→translate
 * ZH→EN) runs end-to-end without codex. Real runs replace every stage with codex
 * output. The Chinese fixtures (sampleZhOutline/sampleZhLessons) are the
 * generation output; sampleCourse is the bilingual translator output (zh matches
 * the Chinese fixtures, en is the translation).
 */
import type { Course, ZhLesson, ZhOutline, Outline, RepoContext } from "../types";

export const sampleCtx: RepoContext = {
  url: "local://nano-agent", localPath: "", sha: "sample", name: "nano-agent",
  defaultBranch: "main",
  summary: "A tiny Claude-Code-like coding agent.",
  loc: 57, languages: { TypeScript: 0.9, Markdown: 0.1 },
  tree: ["src/index.ts", "src/loop.ts", "src/tools.ts", "src/model.ts", "src/prompt.ts", "README.md", "package.json"],
};

export const sampleAnalysis = {
  summary: "nano-agent 是一个极简的编程 agent：一个 while 循环在 LLM 与少量工具之间来回传递控制，直到任务完成。",
  coreMechanisms: ["agent 循环（模型 ↔ 工具）", "工具注册与分发", "系统提示词", "消息/上下文累积", "错误恢复"],
  architecture: "loop.ts 驱动循环；tools.ts 注册读写工具；model.ts 封装 API；prompt.ts 存放系统提示词；index.ts 把它们组装成 CLI。",
  layeredTeachingPath: ["基础：循环 + 提示词", "核心：工具与上下文", "韧性：错误与接线"],
  runningExampleSpine: "逐个机制构建 agent：先循环，再一个工具，再上下文，再错误恢复，最后接上 CLI。",
  gotchas: ["循环只在模型不再发出 tool_use 时停止；工具结果必须以 role:'tool' 消息回传"],
};

/** Chinese generation output — the curriculum stage mock. */
export const sampleZhOutline: ZhOutline = {
  course: { title: "构建迷你 Agent", tagline: "一次只讲一个机制。", repo: { url: "local://nano-agent", name: "nano-agent", sha: "sample" }, spine: "一个随每节课长大的迷你 agent。" },
  sections: [
    {
      id: "l01", title: "基础", summary: "赋予 agent 生命的循环与提示词。", spine: "让基础循环跑起来。",
      lessons: [
        { id: "s01", title: "Agent 循环", difficulty: "beginner", theProblem: "模型只会输出文本，不会自己执行、看不到结果就停了。", objective: "理解模型与工具之间的循环。", mechanism: "agent 循环", filesToRead: ["src/loop.ts"], prereq: [], tags: ["loop"] },
        { id: "s02", title: "系统提示词", difficulty: "beginner", theProblem: "同一个模型，换句话开场表现就不同。", objective: "看清系统提示词如何设定行为。", mechanism: "系统提示词", filesToRead: ["src/prompt.ts"], prereq: ["s01"], tags: ["prompt"] },
      ],
    },
  ],
};

/** Chinese generation output — the lesson:write stage mock. */
export const sampleZhLessons: Record<string, ZhLesson> = {
  s01: {
    id: "s01",
    problem: "大模型只会输出文本。你想让它读写文件，它却停在这——差距就在「循环」。",
    solution: "一个 while(true)：模型调工具就继续，不调就停。",
    howItWorks: [
      { title: "调用模型", desc: "把用户问题作为第一条消息，连同工具定义发给模型。", code: { file: "src/loop.ts", language: "ts", snippet: "while (true) {\n  const response = await callModel({ systemPrompt, messages });", highlightLines: [1, 2] } },
      { title: "判断结束", desc: "没有 tool_use 就返回，否则把模型回答追加进消息。", code: { file: "src/loop.ts", language: "ts", snippet: "if (toolUses.length === 0) return response.content;", highlightLines: [1] } },
    ],
    deepDive: "模型↔工具的循环是所有 agent 框架的本质。上下文即对话本身；长任务需要压缩。模型负责决策（调不调、调哪个），harness 负责执行（跑了就把结果喂回去）。后面所有机制都在这个循环上叠加，循环本身始终不变。",
    tryIt: "python s01_agent_loop/code.py\n试试：让模型列出当前目录的 Python 文件\n观察：模型什么时候调工具（循环继续），什么时候不调（结束）",
    references: [{ title: "Building effective agents", url: "https://www.anthropic.com/research/building-effective-agents" }],
    compare: { rows: [{ label: "停止条件", a: "运行到超时", b: "模型自行停止" }] },
    loc: 16, filesUsed: ["src/loop.ts"],
  },
  s02: {
    id: "s02",
    problem: "同一个模型，表现不同——系统提示词在第一轮之前就定下基调。",
    solution: "把行为规则写成常量，注入 system 字段。",
    howItWorks: [
      { title: "常量字符串", desc: "规则写成常量，注入 system 字段。", code: { file: "src/prompt.ts", language: "ts", snippet: 'export const systemPrompt = "You are nano-agent."; ', highlightLines: [1] } },
    ],
    deepDive: "系统提示词是 agent 的宪法。关键规则放在开头和结尾，中间放次要约束。改动它会显著改变行为，却几乎不增加代码——杠杆比极高。",
    tryIt: "改 systemPrompt 的内容，看模型行为如何变化\n把关键规则同时放在开头和结尾，对比效果",
    references: [],
    compare: { rows: [] },
    loc: 5, filesUsed: ["src/prompt.ts"],
  },
};

/** Final bilingual course (the translator's mock output; zh is the original
 *  Chinese, en is the translation). */
export const sampleCourse: Course = {
  outline: {
    course: { title: { zh: "构建迷你 Agent", en: "Build a Mini Agent" }, tagline: { zh: "一次只讲一个机制。", en: "One mechanism at a time." }, repo: { url: "local://nano-agent", name: "nano-agent", sha: "sample" }, spine: { zh: "一个随每节课长大的迷你 agent。", en: "A tiny agent that grows each lesson." } },
    sections: [
      {
        id: "l01", title: { zh: "基础", en: "Foundations" }, summary: { zh: "赋予 agent 生命的循环与提示词。", en: "The loop and the prompt that give the agent life." },
        lessons: [
          { id: "s01", title: { zh: "Agent 循环", en: "Agent Loop" }, difficulty: "beginner", theProblem: { zh: "模型只会输出文本，不会自己执行、看不到结果就停了。", en: "The model only emits text; it won't run anything or react to results." }, objective: { zh: "理解模型与工具之间的循环。", en: "Understand the loop between model and tools." }, keyFiles: ["src/loop.ts"], prereq: [], tags: ["loop"] },
          { id: "s02", title: { zh: "系统提示词", en: "System Prompt" }, difficulty: "beginner", theProblem: { zh: "同一个模型，换句话开场表现就不同。", en: "Same model, different opening — different behavior." }, objective: { zh: "看清系统提示词如何设定行为。", en: "See how the system prompt sets behavior." }, keyFiles: ["src/prompt.ts"], prereq: ["s01"], tags: ["prompt"] },
        ],
      },
    ],
    lessons: [],
  },
  lessons: {
    s01: {
      id: "s01",
      problem: { zh: "大模型只会输出文本。你想让它读写文件，它却停在这——差距就在「循环」。", en: "An LLM only emits text. You want it to read/write files, but it stops there — the gap is the loop." },
      solution: { zh: "一个 while(true)：模型调工具就继续，不调就停。", en: "A while(true): keep going while the model calls tools, stop when it doesn't." },
      howItWorks: [
        { title: { zh: "调用模型", en: "Call the model" }, desc: { zh: "把用户问题作为第一条消息，连同工具定义发给模型。", en: "Send the user's question plus tool definitions to the model." }, code: { file: "src/loop.ts", language: "ts", snippet: "while (true) {\n  const response = await callModel({ systemPrompt, messages });", highlightLines: [1, 2] } },
        { title: { zh: "判断结束", en: "Check for stop" }, desc: { zh: "没有 tool_use 就返回，否则把模型回答追加进消息。", en: "Return if there's no tool_use; otherwise append the model's reply." }, code: { file: "src/loop.ts", language: "ts", snippet: "if (toolUses.length === 0) return response.content;", highlightLines: [1] } },
      ],
      deepDive: { zh: "模型↔工具的循环是所有 agent 框架的本质。上下文即对话本身；长任务需要压缩。模型负责决策（调不调、调哪个），harness 负责执行（跑了就把结果喂回去）。后面所有机制都在这个循环上叠加，循环本身始终不变。", en: "The model↔tools loop is the essence of every agent framework. Context is the conversation itself; long tasks need compaction. The model decides; the harness executes and feeds results back. Later mechanisms all stack on this loop — the loop itself never changes." },
      tryIt: { zh: "python s01_agent_loop/code.py\n试试：让模型列出当前目录的 Python 文件\n观察：模型什么时候调工具（循环继续），什么时候不调（结束）", en: "python s01_agent_loop/code.py\nTry: ask the model to list Python files in this directory\nWatch: when does it call a tool (loop continues) vs not (loop ends)?" },
      references: [{ title: "Building effective agents", url: "https://www.anthropic.com/research/building-effective-agents" }],
      compare: { rows: [{ label: { zh: "停止条件", en: "Stop condition" }, a: "运行到超时", b: "模型自行停止" }] },
      loc: 16, status: "ok",
    },
    s02: {
      id: "s02",
      problem: { zh: "同一个模型，表现不同——系统提示词在第一轮之前就定下基调。", en: "Same model, different behavior — the system prompt sets the tone before turn one." },
      solution: { zh: "把行为规则写成常量，注入 system 字段。", en: "Encode the behavioral rules as a constant, injected into the system field." },
      howItWorks: [
        { title: { zh: "常量字符串", en: "A constant string" }, desc: { zh: "规则写成常量，注入 system 字段。", en: "Rules as a constant, injected into the system field." }, code: { file: "src/prompt.ts", language: "ts", snippet: 'export const systemPrompt = "You are nano-agent."; ', highlightLines: [1] } },
      ],
      deepDive: { zh: "系统提示词是 agent 的宪法。关键规则放在开头和结尾，中间放次要约束。改动它会显著改变行为，却几乎不增加代码——杠杆比极高。", en: "The system prompt is the agent's constitution. Put critical rules at the start and end; minor constraints in the middle. A small edit shifts behavior dramatically at near-zero code cost — huge leverage." },
      tryIt: { zh: "改 systemPrompt 的内容，看模型行为如何变化\n把关键规则同时放在开头和结尾，对比效果", en: "Edit systemPrompt and watch behavior change\nPut a key rule at both the start and the end; compare" },
      references: [], compare: { rows: [] }, loc: 5, status: "ok",
    },
  },
};
// keep types referenced
void (null as unknown as Outline);
