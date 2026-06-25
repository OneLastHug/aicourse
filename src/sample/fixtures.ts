/**
 * v2 mock sample data (compact) — used by the offline `--sample` mode so the full
 * v2 pipeline (Chinese-first: analyze→curriculum→lessons→validate×2→translate
 * ZH→EN) runs end-to-end without codex. Real runs replace every stage with codex
 * output. The Chinese fixtures (sampleZhOutline/sampleZhLessons) are the
 * generation output; sampleCourse is the bilingual translator output (zh matches
 * the Chinese fixtures, en is the translation).
 */
import type { Course, ZhLesson, ZhOutline, Outline, RepoContext, SpineArtifact } from "../types";

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
  spineLanguage: "ts",
  runningExampleSpine: [
    "s01: 最小 while 循环（模型↔无工具）",
    "s02: + 系统提示词常量",
    "s03: + 第一个工具与分发",
    "s04: + 上下文累积",
  ],
  archDiagram: {
    kind: "mermaid",
    caption: "nano-agent 总体架构",
    diagram: 'flowchart TD\n  index["index.ts CLI"] --> loop["loop.ts 循环"]\n  prompt["prompt.ts 系统提示词"] --> loop\n  loop --> model["model.ts 调模型"]\n  loop --> tools["tools.ts 读写工具"]',
  },
  gotchas: ["循环只在模型不再发出 tool_use 时停止；工具结果必须以 role:'tool' 消息回传"],
};

/** Chinese generation output — the curriculum stage mock. */
export const sampleZhOutline: ZhOutline = {
  course: { title: "构建迷你 Agent", tagline: "一次只讲一个机制。", repo: { url: "local://nano-agent", name: "nano-agent", sha: "sample" }, spine: "一个随每节课长大的迷你 agent。", thesis: "所有 agent 都是同一个循环，逐个机制叠上去。" },
  archDiagram: {
    kind: "mermaid",
    caption: "nano-agent 总体架构",
    diagram: 'flowchart TD\n  index["index.ts CLI"] --> loop["loop.ts 循环"]\n  prompt["prompt.ts 系统提示词"] --> loop\n  loop --> model["model.ts 调模型"]\n  loop --> tools["tools.ts 读写工具"]',
  },
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

/** Spine stage mock — runnable teaching-code snapshots; s02 is a superset of s01. */
export const sampleSpine: Record<string, SpineArtifact> = {
  s01: {
    lessonId: "s01",
    path: "s01_agent_loop/code.ts",
    language: "ts",
    code: `// s01_agent_loop/code.ts — a minimal agent loop
import { callModel } from "./model"; // stub LLM, no API key needed

export async function run(userMsg: string) {
  const messages = [{ role: "user", content: userMsg }];
  while (true) {
    const reply = await callModel({ messages });
    const toolUses = reply.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) return reply;
    messages.push({ role: "assistant", content: reply });
  }
}

if (import.meta.main) run("list the files here").then(console.log);
`,
    runCmd: "npx tsx s01_agent_loop/code.ts",
    addedLines: [],
  },
  s02: {
    lessonId: "s02",
    path: "s02_system_prompt/code.ts",
    language: "ts",
    code: `// s02_system_prompt/code.ts — agent loop + system prompt
import { callModel } from "./model"; // stub LLM, no API key needed

const systemPrompt = "You are nano-agent. Use tools to read and write files.";

export async function run(userMsg: string) {
  const messages = [{ role: "user", content: userMsg }];
  while (true) {
    const reply = await callModel({ systemPrompt, messages });
    const toolUses = reply.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) return reply;
    messages.push({ role: "assistant", content: reply });
  }
}

if (import.meta.main) run("list the files here").then(console.log);
`,
    runCmd: "npx tsx s02_system_prompt/code.ts",
    addedLines: [4, 8],
    prevLessonId: "s01",
  },
};

/** Chinese generation output — the lesson:write stage mock. */
export const sampleZhLessons: Record<string, ZhLesson> = {
  s01: {
    id: "s01",
    principle: "循环让模型从「说」变成「做」。",
    problem: "大模型只会输出文本。你想让它读写文件，它却停在这——差距就在「循环」。",
    solution: "一个 while(true)：模型调工具就继续，不调就停。",
    diagram: { kind: "mermaid", caption: "Agent 循环", diagram: 'flowchart LR\n  user["用户消息"] --> model["调用模型"]\n  model --> check{"有 tool_use?"}\n  check -->|"有"| exec["执行工具"] --> model\n  check -->|"无"| done["返回结果"]' },
    spine: sampleSpine.s01,
    howItWorks: [
      { title: "调用模型", desc: "把用户问题作为第一条消息，连同工具定义发给模型。", code: { file: "s01_agent_loop/code.ts", language: "ts", snippet: "const reply = await callModel({ messages });", highlightLines: [1], isSpine: true } },
      { title: "判断结束", desc: "没有 tool_use 就返回，否则把模型回答追加进消息。", code: { file: "s01_agent_loop/code.ts", language: "ts", snippet: "if (toolUses.length === 0) return reply;", highlightLines: [1], isSpine: true } },
      { title: "对照真实源码", desc: "真实仓库里循环在 loop.ts 的 loop() 中，还多了工具结果回传与错误处理。", code: { file: "src/loop.ts", language: "ts", snippet: "while (true) {\n  const response = await callModel({ systemPrompt, messages });", highlightLines: [1, 2], isSpine: false, symbol: "loop" } },
    ],
    deepDive: `## 为什么是循环
模型只会输出文本；没有循环，它只能「说」不能「做」。把模型调用放进 while，让它读到工具结果后继续决策，才把"对话"变成"执行"。

## 取舍
- 用"是否还有 tool_use"判断停止，而不是让模型显式说"我做完了"——更稳，不依赖措辞。
- 教学版一次只跑一个工具、不做并行，换来代码清晰。

## 与真实实现的差距
真实仓库在循环外还包了不少东西：
- 工具结果要以 \`role:"tool"\` 消息回传，并处理报错与重试。
- 上下文过长要做 compaction 压缩。
- 加了超时、中断、权限校验。

这些都挂在循环外围，循环本身始终不变。

## 边界与坑
模型可能反复调用同一个工具陷入死循环——真实实现会加步数上限或重复检测。`,
    tryIt: "npx tsx s01_agent_loop/code.ts\n试试：让模型列出当前目录的 Python 文件\n观察：模型什么时候调工具（循环继续），什么时候不调（结束）",
    references: [{ title: "Building effective agents", url: "https://www.anthropic.com/research/building-effective-agents" }],
    compare: { rows: [{ label: "停止条件", a: "运行到超时", b: "模型自行停止" }] },
    loc: 14, badges: { loc: 14, difficulty: "beginner", concepts: ["agent-loop", "tool_use", "while-true"] }, filesUsed: ["src/loop.ts"],
  },
  s02: {
    id: "s02",
    principle: "提示词是 agent 的宪法。",
    problem: "同一个模型，表现不同——系统提示词在第一轮之前就定下基调。",
    solution: "把行为规则写成常量，注入 system 字段。",
    diagram: { kind: "mermaid", caption: "系统提示词定基调", diagram: 'flowchart TD\n  sys["系统提示词"] --> behavior["模型行为基调"]\n  user["用户消息"] --> behavior' },
    spine: sampleSpine.s02,
    howItWorks: [
      { title: "常量字符串", desc: "规则写成常量，循环里把它作为 systemPrompt 传给模型。", code: { file: "s02_system_prompt/code.ts", language: "ts", snippet: 'const systemPrompt = "You are nano-agent. Use tools to read and write files.";', highlightLines: [1], isSpine: true } },
      { title: "对照真实源码", desc: "真实仓库把系统提示词单独放在 prompt.ts，便于迭代与拼接。", code: { file: "src/prompt.ts", language: "ts", snippet: 'export const systemPrompt = "You are nano-agent."; ', highlightLines: [1], isSpine: false, symbol: "systemPrompt" } },
    ],
    deepDive: `## 为什么放在 system
system 字段在第一轮之前就定下基调，权重高于普通用户消息。把行为规则放这里，比每轮重复叮嘱更省 token、更稳定。

## 取舍
- 写成常量 vs 模板拼接：常量简单、可读；真实项目常按工具集/权限动态拼接。
- 关键规则放开头和结尾——模型对首尾更敏感。

## 与真实实现的差距
真实仓库的 system prompt 往往上千行，按场景拼接工具说明、安全边界、环境信息；教学版只留一句，够说明"它如何设定行为"。

## 边界与坑
改一句话就可能显著改变行为，却几乎不增加代码——杠杆极高，也意味着容易踩坑，需要回归测试。`,
    tryIt: "改 systemPrompt 的内容，看模型行为如何变化\n把关键规则同时放在开头和结尾，对比效果",
    references: [],
    compare: { rows: [] },
    loc: 14, badges: { loc: 14, difficulty: "beginner", concepts: ["system-prompt", "behavior"] }, filesUsed: ["src/prompt.ts"],
  },
};

/** Final bilingual course (the translator's mock output; zh is the original
 *  Chinese, en is the translation). */
export const sampleCourse: Course = {
  outline: {
    course: { title: { zh: "构建迷你 Agent", en: "Build a Mini Agent" }, tagline: { zh: "一次只讲一个机制。", en: "One mechanism at a time." }, repo: { url: "local://nano-agent", name: "nano-agent", sha: "sample" }, spine: { zh: "一个随每节课长大的迷你 agent。", en: "A tiny agent that grows each lesson." }, thesis: { zh: "所有 agent 都是同一个循环，逐个机制叠上去。", en: "Every agent is the same loop, with one mechanism stacked on at a time." } },
    archDiagram: { kind: "mermaid", caption: { zh: "nano-agent 总体架构", en: "nano-agent architecture" }, diagram: 'flowchart TD\n  index["index.ts CLI"] --> loop["loop.ts 循环"]\n  prompt["prompt.ts 系统提示词"] --> loop\n  loop --> model["model.ts 调模型"]\n  loop --> tools["tools.ts 读写工具"]' },
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
      principle: { zh: "循环让模型从「说」变成「做」。", en: "The loop turns the model from talking into doing." },
      problem: { zh: "大模型只会输出文本。你想让它读写文件，它却停在这——差距就在「循环」。", en: "An LLM only emits text. You want it to read/write files, but it stops there — the gap is the loop." },
      solution: { zh: "一个 while(true)：模型调工具就继续，不调就停。", en: "A while(true): keep going while the model calls tools, stop when it doesn't." },
      diagram: { kind: "mermaid", caption: { zh: "Agent 循环", en: "The agent loop" }, diagram: 'flowchart LR\n  user["用户消息"] --> model["调用模型"]\n  model --> check{"有 tool_use?"}\n  check -->|"有"| exec["执行工具"] --> model\n  check -->|"无"| done["返回结果"]' },
      spine: sampleSpine.s01,
      howItWorks: [
        { title: { zh: "调用模型", en: "Call the model" }, desc: { zh: "把用户问题作为第一条消息，连同工具定义发给模型。", en: "Send the user's question plus tool definitions to the model." }, code: { file: "s01_agent_loop/code.ts", language: "ts", snippet: "const reply = await callModel({ messages });", highlightLines: [1], isSpine: true } },
        { title: { zh: "判断结束", en: "Check for stop" }, desc: { zh: "没有 tool_use 就返回，否则把模型回答追加进消息。", en: "Return if there's no tool_use; otherwise append the model's reply." }, code: { file: "s01_agent_loop/code.ts", language: "ts", snippet: "if (toolUses.length === 0) return reply;", highlightLines: [1], isSpine: true } },
        { title: { zh: "对照真实源码", en: "Compare with the real source" }, desc: { zh: "真实仓库里循环在 loop.ts 的 loop() 中，还多了工具结果回传与错误处理。", en: "In the real repo the loop lives in loop.ts's loop(), with tool-result feedback and error handling added." }, code: { file: "src/loop.ts", language: "ts", snippet: "while (true) {\n  const response = await callModel({ systemPrompt, messages });", highlightLines: [1, 2], isSpine: false, symbol: "loop" } },
      ],
      deepDive: { zh: `## 为什么是循环
模型只会输出文本；没有循环，它只能「说」不能「做」。把模型调用放进 while，让它读到工具结果后继续决策，才把"对话"变成"执行"。

## 取舍
- 用"是否还有 tool_use"判断停止，而不是让模型显式说"我做完了"——更稳，不依赖措辞。
- 教学版一次只跑一个工具、不做并行，换来代码清晰。

## 与真实实现的差距
真实仓库在循环外还包了不少东西：
- 工具结果要以 \`role:"tool"\` 消息回传，并处理报错与重试。
- 上下文过长要做 compaction 压缩。
- 加了超时、中断、权限校验。

这些都挂在循环外围，循环本身始终不变。

## 边界与坑
模型可能反复调用同一个工具陷入死循环——真实实现会加步数上限或重复检测。`, en: `## Why a loop
An LLM only emits text; without a loop it can only "talk", not "act". Wrapping the model call in a while loop — so it reads tool results and keeps deciding — is what turns a conversation into execution.

## Trade-offs
- Stop on "no more tool_use" rather than asking the model to say "I'm done" — sturdier, not wording-dependent.
- The teaching version runs one tool at a time, no parallelism, trading throughput for clarity.

## Gap from the real implementation
The real repo wraps a lot around this loop:
- Tool results must be fed back as \`role:"tool"\` messages, with error handling and retries.
- Long context needs compaction.
- Timeouts, cancellation, and permission checks are added.

All of it hangs around the loop — the loop itself never changes.

## Edges & gotchas
The model can loop forever calling the same tool — the real implementation adds a step cap or repeat detection.` },
      tryIt: { zh: "npx tsx s01_agent_loop/code.ts\n试试：让模型列出当前目录的 Python 文件\n观察：模型什么时候调工具（循环继续），什么时候不调（结束）", en: "npx tsx s01_agent_loop/code.ts\nTry: ask the model to list Python files in this directory\nWatch: when does it call a tool (loop continues) vs not (loop ends)?" },
      references: [{ title: "Building effective agents", url: "https://www.anthropic.com/research/building-effective-agents" }],
      compare: { rows: [{ label: { zh: "停止条件", en: "Stop condition" }, a: "运行到超时", b: "模型自行停止" }] },
      loc: 14, badges: { loc: 14, difficulty: "beginner", concepts: ["agent-loop", "tool_use", "while-true"] }, status: "ok",
    },
    s02: {
      id: "s02",
      principle: { zh: "提示词是 agent 的宪法。", en: "The prompt is the agent's constitution." },
      problem: { zh: "同一个模型，表现不同——系统提示词在第一轮之前就定下基调。", en: "Same model, different behavior — the system prompt sets the tone before turn one." },
      solution: { zh: "把行为规则写成常量，注入 system 字段。", en: "Encode the behavioral rules as a constant, injected into the system field." },
      diagram: { kind: "mermaid", caption: { zh: "系统提示词定基调", en: "The system prompt sets the tone" }, diagram: 'flowchart TD\n  sys["系统提示词"] --> behavior["模型行为基调"]\n  user["用户消息"] --> behavior' },
      spine: sampleSpine.s02,
      howItWorks: [
        { title: { zh: "常量字符串", en: "A constant string" }, desc: { zh: "规则写成常量，循环里把它作为 systemPrompt 传给模型。", en: "Rules as a constant, passed into the loop as systemPrompt." }, code: { file: "s02_system_prompt/code.ts", language: "ts", snippet: 'const systemPrompt = "You are nano-agent. Use tools to read and write files.";', highlightLines: [1], isSpine: true } },
        { title: { zh: "对照真实源码", en: "Compare with the real source" }, desc: { zh: "真实仓库把系统提示词单独放在 prompt.ts，便于迭代与拼接。", en: "The real repo keeps the system prompt in its own prompt.ts for easy iteration and composition." }, code: { file: "src/prompt.ts", language: "ts", snippet: 'export const systemPrompt = "You are nano-agent."; ', highlightLines: [1], isSpine: false, symbol: "systemPrompt" } },
      ],
      deepDive: { zh: `## 为什么放在 system
system 字段在第一轮之前就定下基调，权重高于普通用户消息。把行为规则放这里，比每轮重复叮嘱更省 token、更稳定。

## 取舍
- 写成常量 vs 模板拼接：常量简单、可读；真实项目常按工具集/权限动态拼接。
- 关键规则放开头和结尾——模型对首尾更敏感。

## 与真实实现的差距
真实仓库的 system prompt 往往上千行，按场景拼接工具说明、安全边界、环境信息；教学版只留一句，够说明"它如何设定行为"。

## 边界与坑
改一句话就可能显著改变行为，却几乎不增加代码——杠杆极高，也意味着容易踩坑，需要回归测试。`, en: `## Why put it in system
The system field sets the tone before turn one and outweighs ordinary user messages. Putting behavioral rules here is cheaper (tokens) and steadier than re-stating them every turn.

## Trade-offs
- Constant vs templated: a constant is simple and readable; real projects assemble it dynamically by toolset/permissions.
- Put key rules at the start AND end — models weight the edges more.

## Gap from the real implementation
A real repo's system prompt is often thousands of lines, composing tool docs, safety boundaries, and environment info per scenario; the teaching version keeps one line — enough to show "how it sets behavior".

## Edges & gotchas
One sentence can shift behavior dramatically at near-zero code cost — huge leverage, but also easy to break, so it needs regression tests.` },
      tryIt: { zh: "改 systemPrompt 的内容，看模型行为如何变化\n把关键规则同时放在开头和结尾，对比效果", en: "Edit systemPrompt and watch behavior change\nPut a key rule at both the start and the end; compare" },
      references: [], compare: { rows: [] }, loc: 14, badges: { loc: 14, difficulty: "beginner", concepts: ["system-prompt", "behavior"] }, status: "ok",
    },
  },
};
// keep types referenced
void (null as unknown as Outline);
