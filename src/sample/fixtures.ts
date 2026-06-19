/**
 * Authored bilingual course used by the offline `--sample` mode and by the
 * shipped site demo. The mock codex driver returns these when sample mode runs,
 * so the site renders with real, high-quality content without needing codex.
 *
 * Theme mirrors learn.shareai.run: build a nano Claude-Code-like agent from 0
 * to 1, one mechanism at a time. Code snippets quote the real files in
 * samples/nano-agent/src/*.
 */
import type { Course, Lesson, Outline } from "../types";

export const sampleOutline: Outline = {
  course: {
    title: {
      zh: "从零构建一个迷你编程 Agent",
      en: "Build a Nano Coding Agent from 0 to 1",
    },
    tagline: {
      zh: "一次只讲一个机制，亲手拼出一个 Claude Code 风格的智能体。",
      en: "One mechanism at a time — assemble a Claude-Code-like agent by hand.",
    },
    repo: { url: "local://nano-agent", name: "nano-agent", sha: "sample" },
  },
  lessons: [
    {
      id: "s01",
      title: { zh: "工具调用（Agent 循环）", en: "Tool Use — the Agent Loop" },
      difficulty: "beginner",
      theProblem: {
        zh: "模型只会说话，怎样才能让它真正去读写文件、执行动作？",
        en: "The model can only talk — how do we make it actually read/write files and take action?",
      },
      objective: {
        zh: "理解 while 循环如何让模型与工具反复交互，直到任务完成。",
        en: "Understand how a while-loop bounces control between the model and tools until the task is done.",
      },
      keyFiles: ["src/loop.ts", "src/index.ts"],
      prereq: [],
      tags: ["agent-loop", "tool-use"],
    },
    {
      id: "s02",
      title: { zh: "系统提示词", en: "System Prompt" },
      difficulty: "beginner",
      theProblem: {
        zh: "同一个模型，为什么会表现出完全不同的「性格」？",
        en: "Same model — why does it behave like a completely different agent?",
      },
      objective: {
        zh: "看清系统提示词如何在一开始就塑造 agent 的行为边界。",
        en: "See how the system prompt sets the agent's behavior budget before turn one.",
      },
      keyFiles: ["src/prompt.ts", "src/model.ts"],
      prereq: ["s01"],
      tags: ["prompting"],
    },
    {
      id: "s03",
      title: { zh: "工具注册表", en: "The Tool Registry" },
      difficulty: "intermediate",
      theProblem: {
        zh: "模型点了 read_file，我们怎么安全地把请求转成一次真正的函数调用？",
        en: "When the model calls read_file, how do we safely route that to a real function?",
      },
      objective: {
        zh: "把工具建模成「描述 + 异步函数」，并实现统一的执行入口。",
        en: "Model a tool as description + async function and build one execution entry point.",
      },
      keyFiles: ["src/tools.ts"],
      prereq: ["s01"],
      tags: ["tools", "dispatch"],
    },
    {
      id: "s04",
      title: { zh: "消息与上下文", en: "Messages & Context" },
      difficulty: "intermediate",
      theProblem: {
        zh: "Agent 怎么「记得」自己刚刚做过什么？",
        en: "How does the agent remember what it just did?",
      },
      objective: {
        zh: "理解 messages 数组如何累积成上下文，并掌握会话记忆的边界。",
        en: "Understand how the messages array accumulates into context — and where memory ends.",
      },
      keyFiles: ["src/loop.ts", "src/index.ts"],
      prereq: ["s01", "s03"],
      tags: ["context", "memory"],
    },
    {
      id: "s05",
      title: { zh: "错误恢复", en: "Error Recovery" },
      difficulty: "advanced",
      theProblem: {
        zh: "工具抛错了，agent 会崩溃还是自我修正？",
        en: "When a tool throws, does the agent crash — or course-correct?",
      },
      objective: {
        zh: "把错误变成消息塞回去，让模型基于失败继续推理。",
        en: "Turn errors into messages so the model can keep reasoning from the failure.",
      },
      keyFiles: ["src/tools.ts", "src/loop.ts"],
      prereq: ["s03", "s04"],
      tags: ["resilience"],
    },
    {
      id: "s06",
      title: { zh: "把循环串起来", en: "Wiring It All Together" },
      difficulty: "advanced",
      theProblem: {
        zh: "零散的模块，如何拼成一个能跑的命令行 agent？",
        en: "How do the pieces become a single runnable CLI agent?",
      },
      objective: {
        zh: "用入口文件把提示词、循环、工具连成一个可交互的程序。",
        en: "Wire prompt + loop + tools into one interactive program via the entry file.",
      },
      keyFiles: ["src/index.ts", "src/model.ts"],
      prereq: ["s01", "s02", "s03"],
      tags: ["integration"],
    },
  ],
};

export const sampleLessons: Record<string, Lesson> = {
  s01: {
    id: "s01",
    problem: {
      zh: "大语言模型本身只会输出文本。我们想要的是一个能读写文件、执行命令的 agent。差距在哪？差距在「循环」——不断把模型的输出喂回工具，再把工具的结果喂回模型，直到模型不再需要工具。",
      en: "An LLM only emits text. We want an agent that reads and writes files and runs commands. The missing piece is the loop: feed the model's output into tools, feed tool results back into the model, and keep going until the model stops calling tools.",
    },
    howItWorks: [
      {
        title: { zh: "Step 1 · 不停地调用模型", en: "Step 1 · Keep calling the model" },
        desc: {
          zh: "用一个 while (true) 把模型调用包起来。每一轮都把完整对话发回去，让模型看到之前发生了什么。",
          en: "Wrap the model call in while (true). Each turn sends the full conversation back so the model sees what happened so far.",
        },
        code: {
          file: "src/loop.ts",
          language: "ts",
          snippet: `export async function run({ messages, systemPrompt }) {
  while (true) {
    const response = await callModel({ systemPrompt, messages });`,
          highlightLines: [2, 3],
        },
      },
      {
        title: { zh: "Step 2 · 记录模型的每一条回复", en: "Step 2 · Record every assistant reply" },
        desc: {
          zh: "模型的回复要原样追加进 messages，这样下一轮它才「记得」自己说过什么。",
          en: "Append the model's reply verbatim to messages so it remembers what it said next turn.",
        },
        code: {
          file: "src/loop.ts",
          language: "ts",
          snippet: `    messages.push({ role: "assistant", content: response.content });`,
          highlightLines: [1],
        },
      },
      {
        title: { zh: "Step 3 · 判断是否结束", en: "Step 3 · Decide when to stop" },
        desc: {
          zh: "如果这一轮没有 tool_use 块，说明模型不再需要工具，循环结束——这就是 agent 的「停下」信号。",
          en: "If there's no tool_use block this turn, the model needs no more tools and the loop ends — that's the agent's stop signal.",
        },
        code: {
          file: "src/loop.ts",
          language: "ts",
          snippet: `    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      return response.content;
    }`,
          highlightLines: [1, 2, 3],
        },
      },
      {
        title: { zh: "Step 4 · 执行工具并把结果喂回去", en: "Step 4 · Run tools, feed results back" },
        desc: {
          zh: "对每个工具调用执行真正的函数，把结果以 role: 'tool' 塞回 messages。然后循环回到顶部，模型会读到结果继续推理。",
          en: "For each tool call, run the real function and push the result back as a role:'tool' message. The loop returns to the top, the model reads the result, and keeps reasoning.",
        },
        code: {
          file: "src/loop.ts",
          language: "ts",
          snippet: `    for (const use of toolUses) {
      const result = await executeTool(use.name, use.input);
      messages.push({ role: "tool", tool_use_id: use.id, content: String(result) });
    }`,
          highlightLines: [2, 3],
        },
      },
    ],
    deepDive: {
      zh: "这个「模型 ↔ 工具」的循环就是所有 agent 框架的本质——ReAct、function calling、agentic loop 都是它的变体。关键洞察：**上下文不是存储，而是对话本身**。每一步的结果都成为下一步的输入，agent 的「记忆」就是这条不断生长的消息链。代价是上下文长度：长任务需要压缩或摘要，否则窗口会被占满。",
      en: "This model↔tools loop is the essence of every agent framework — ReAct, function calling, agentic loops are all variations. The key insight: **context isn't storage, it's the conversation itself**. Each step's result becomes the next step's input; the agent's memory is this ever-growing message chain. The cost is context length: long tasks need compaction or summarization or the window fills up.",
    },
    references: [
      { title: "Building effective agents (Anthropic)", url: "https://www.anthropic.com/research/building-effective-agents" },
      { title: "ReAct: Synergizing Reasoning and Acting", url: "https://arxiv.org/abs/2210.03629" },
    ],
    compare: {
      rows: [
        { label: { zh: "单次问答", en: "Single Q&A" }, a: "一问一答，无法行动", b: "持续循环，可调用工具" },
        { label: { zh: "停止条件", en: "Stop condition" }, a: "永远跑到超时", b: "模型主动停止" },
      ],
    },
    loc: 16,
    status: "ok",
  },

  s02: {
    id: "s02",
    problem: {
      zh: "同样一个模型，问它同样的问题，为什么有时候像个严谨的工程师、有时候像个话痨？答案在「系统提示词」——它在任何对话开始之前就定下了基调。",
      en: "Same model, same question — why is it sometimes a careful engineer and sometimes chatty? The answer is the system prompt, which sets the tone before any conversation begins.",
    },
    howItWorks: [
      {
        title: { zh: "Step 1 · 提示词是一段普通字符串", en: "Step 1 · The prompt is just a string" },
        desc: {
          zh: "把行为要求写成一段常量。它会被原样塞进 API 的 system 字段。",
          en: "Write the behavioral rules as a constant string. It goes verbatim into the API's system field.",
        },
        code: {
          file: "src/prompt.ts",
          language: "ts",
          snippet: `export const systemPrompt = \`You are nano-agent, a tiny coding assistant.
- Read files before editing them.
- Prefer the smallest possible change.
- When you are finished, reply with plain text and no tool calls.\`;`,
          highlightLines: [1, 2, 3, 4],
        },
      },
      {
        title: { zh: "Step 2 · 在每次请求里注入它", en: "Step 2 · Inject it on every request" },
        desc: {
          zh: "把 systemPrompt 放进请求体。模型在生成第一个字之前，就已经「是」这个 agent 了。",
          en: "Put systemPrompt into the request body. Before generating a single token, the model already 'is' this agent.",
        },
        code: {
          file: "src/model.ts",
          language: "ts",
          snippet: `  body: JSON.stringify({ system: systemPrompt, messages, model: "nano-1" }),`,
          highlightLines: [1],
        },
      },
    ],
    deepDive: {
      zh: "系统提示词是 agent 的「宪法」：它定义角色、约束和风格。生产级 agent 的提示词往往上千字，包含工具说明、安全规则、输出格式。一个小技巧：把最关键的规则放在**开头和结尾**（首因/近因效应），中间放细节。",
      en: "The system prompt is the agent's constitution: it defines role, constraints, and style. Production prompts often run thousands of words covering tools, safety, and output format. A useful trick: put the most critical rules at the **start and end** (primacy/recency effects), with details in the middle.",
    },
    references: [
      { title: "Prompt engineering overview (Anthropic)", url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview" },
    ],
    compare: {
      rows: [
        { label: { zh: "无提示词", en: "No prompt" }, a: "行为随机、易跑偏", b: "角色稳定、可预测" },
        { label: { zh: "位置", en: "Position" }, a: "混在用户消息里", b: "独立 system 字段" },
      ],
    },
    loc: 5,
    status: "ok",
  },

  s03: {
    id: "s03",
    problem: {
      zh: "模型喊了一声 read_file，但模型不能真的去碰磁盘。我们需要一个桥梁：把模型给出的工具名 + 参数，安全地映射到一次真正的函数执行。",
      en: "The model calls read_file, but it can't touch the disk. We need a bridge: map the tool name + arguments the model gives us to a real function execution, safely.",
    },
    howItWorks: [
      {
        title: { zh: "Step 1 · 每个工具 = 描述 + 异步函数", en: "Step 1 · A tool = description + async fn" },
        desc: {
          zh: "用一个对象把「这个工具是干嘛的」和「怎么跑」放在一起。描述会暴露给模型，run 才是真正的实现。",
          en: "Group 'what it does' and 'how to run it' in one object. The description is exposed to the model; run is the real implementation.",
        },
        code: {
          file: "src/tools.ts",
          language: "ts",
          snippet: `export const TOOLS = {
  read_file: { description: "Read a file from disk", run: ({ path }) => readFile(path, "utf8") },
  write_file: {
    description: "Write text to a file",
    run: ({ path, content }) => writeFile(path, content, "utf8").then(() => "ok"),
  },
};`,
          highlightLines: [1, 2, 3],
        },
      },
      {
        title: { zh: "Step 2 · 一个统一的执行入口", en: "Step 2 · One execution entry point" },
        desc: {
          zh: "executeTool 负责查表和调用。未知工具要报错而不是静默失败——否则模型会陷入幻觉循环。",
          en: "executeTool does the lookup and the call. An unknown tool must error, not silently fail — otherwise the model loops on a hallucination.",
        },
        code: {
          file: "src/tools.ts",
          language: "ts",
          snippet: `export async function executeTool(name, input) {
  const tool = TOOLS[name];
  if (!tool) throw new Error(\`unknown tool: \${name}\`);
  return tool.run(input);
}`,
          highlightLines: [2, 3],
        },
      },
    ],
    deepDive: {
      zh: "真实 agent 的工具远不止两个：shell、grep、edit、todo、web_fetch……关键设计是把工具做成**声明式注册表**，新增工具只需加一行，不改循环代码。安全要点：永远校验参数、限制路径范围（沙箱）、给危险操作加确认。模型给出的 input 不可信。",
      en: "Real agents have far more than two tools: shell, grep, edit, todo, web_fetch… The key design is a declarative registry: adding a tool is one line and never touches the loop. Safety essentials: always validate args, constrain paths (sandbox), and gate dangerous operations. Never trust input from the model.",
    },
    references: [
      { title: "Tool use guide (Anthropic)", url: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview" },
    ],
    compare: {
      rows: [
        { label: { zh: "硬编码分支", en: "Hardcoded if/else" }, a: "每加一个工具改循环", b: "注册表里加一行" },
        { label: { zh: "错误处理", en: "Error handling" }, a: "未知工具返回 null", b: "抛错喂回模型" },
      ],
    },
    loc: 14,
    status: "ok",
  },

  s04: {
    id: "s04",
    problem: {
      zh: "agent 怎么记得自己三步之前读过哪个文件？它没有数据库——它的「记忆」就是那个不断增长的 messages 数组。",
      en: "How does the agent remember which file it read three steps ago? It has no database — its 'memory' is that growing messages array.",
    },
    howItWorks: [
      {
        title: { zh: "Step 1 · 从用户的初始消息开始", en: "Step 1 · Start from the initial user message" },
        desc: {
          zh: "入口构造第一条消息。这一条决定了整个任务。",
          en: "The entry point builds the first message. This single message defines the whole task.",
        },
        code: {
          file: "src/index.ts",
          language: "ts",
          snippet: `const messages = [{ role: "user", content: process.argv[2] ?? "say hello" }];`,
          highlightLines: [1],
        },
      },
      {
        title: { zh: "Step 2 · 每一轮都在追加，从不删除", en: "Step 2 · Append every turn, never delete" },
        desc: {
          zh: "assistant 的回复、tool 的结果，全部 push 进同一个数组。下一轮把整个数组发给模型——这就是「上下文」。",
          en: "Assistant replies and tool results all push into the same array. Next turn sends the whole array to the model — that IS the context.",
        },
        code: {
          file: "src/loop.ts",
          language: "ts",
          snippet: `    messages.push({ role: "assistant", content: response.content });
    ...
    messages.push({ role: "tool", tool_use_id: use.id, content: String(result) });`,
          highlightLines: [1, 3],
        },
      },
    ],
    deepDive: {
      zh: "这种「无状态模型 + 有状态上下文」的设计非常强大，但有上限：上下文窗口。长对话必须压缩——滑动窗口、摘要、或把旧内容存到外部记忆（向量库/文件）。**真正的工程难点不在循环，而在管理上下文增长。**",
      en: "This 'stateless model + stateful context' design is powerful but bounded: the context window. Long conversations need compaction — sliding window, summarization, or offloading old content to external memory (vector store / files). **The hard engineering isn't the loop — it's managing context growth.**",
    },
    references: [
      { title: "Managing context for long agents (Anthropic cookbook)", url: "https://github.com/anthropics/anthropic-cookbook" },
    ],
    compare: {
      rows: [
        { label: { zh: "状态存放", en: "Where state lives" }, a: "隐藏在模型内部", b: "显式 messages 数组" },
        { label: { zh: "上限", en: "Limit" }, a: "理论上无限", b: "受上下文窗口约束" },
      ],
    },
    loc: 12,
    status: "ok",
  },

  s05: {
    id: "s05",
    problem: {
      zh: "用户让 agent 改一个不存在的文件。read_file 抛错了。脆弱的 agent 直接崩溃；健壮的 agent 把错误告诉模型，让模型自己想办法。",
      en: "The user asks the agent to edit a file that doesn't exist. read_file throws. A fragile agent crashes; a robust agent tells the model about the error and lets it recover.",
    },
    howItWorks: [
      {
        title: { zh: "Step 1 · executeTool 会抛错", en: "Step 1 · executeTool throws" },
        desc: {
          zh: "工具失败时，错误是信息，不是终点。我们要捕获它而不是让它冒泡。",
          en: "When a tool fails, the error is information, not a dead end. We catch it instead of letting it bubble.",
        },
        code: {
          file: "src/tools.ts",
          language: "ts",
          snippet: `export async function executeTool(name, input) {
  const tool = TOOLS[name];
  if (!tool) throw new Error(\`unknown tool: \${name}\`);
  return tool.run(input); // readFile may throw ENOENT
}`,
          highlightLines: [4],
        },
      },
      {
        title: { zh: "Step 2 · 把错误变成一条消息", en: "Step 2 · Turn the error into a message" },
        desc: {
          zh: "在循环里 try/catch，把 error.message 以 tool 结果的身份塞回 messages。模型读到 'file not found' 后，通常会改用 write_file 创建它。",
          en: "try/catch in the loop and push error.message back as the tool result. Reading 'file not found', the model typically switches to write_file to create it.",
        },
        code: {
          file: "src/loop.ts",
          language: "ts",
          snippet: `    for (const use of toolUses) {
      try {
        const result = await executeTool(use.name, use.input);
        messages.push({ role: "tool", tool_use_id: use.id, content: String(result) });
      } catch (e) {
        messages.push({ role: "tool", tool_use_id: use.id, content: \`Error: \${e.message}\` });
      }
    }`,
          highlightLines: [6, 7],
        },
      },
    ],
    deepDive: {
      zh: "自我修正能力是 agent 和脚本的分水岭。把错误喂回去，模型经常能：重试、换路径、修正参数、或向用户求助。生产实践：给错误加结构化分类（可重试 / 致命），避免无限重试循环（加最大重试次数 + 退避）。",
      en: "Self-correction is the dividing line between an agent and a script. Fed the error, the model often: retries, picks a different path, fixes its arguments, or asks the user. Production practice: classify errors (retryable / fatal) and cap retries with backoff to avoid infinite loops.",
    },
    references: [
      { title: "Designing resilient agents (Anthropic)", url: "https://www.anthropic.com/engineering" },
    ],
    compare: {
      rows: [
        { label: { zh: "遇到错误", en: "On error" }, a: "进程崩溃退出", b: "错误变成下一轮输入" },
        { label: { zh: "重试", en: "Retry" }, a: "无上限，可能死循环", b: "有上限 + 退避" },
      ],
    },
    loc: 10,
    status: "ok",
  },

  s06: {
    id: "s06",
    problem: {
      zh: "我们有了循环、提示词、工具——它们还是散落的模块。最后一步：用一个入口文件把它们拼成一个能 `node src/index.ts '...'` 直接跑起来的命令行 agent。",
      en: "We have a loop, a prompt, and tools — but they're scattered modules. The last step: one entry file that wires them into a runnable CLI agent you can launch with node src/index.ts '...'.",
    },
    howItWorks: [
      {
        title: { zh: "Step 1 · 导入各模块", en: "Step 1 · Import the modules" },
        desc: {
          zh: "入口文件只做组装：从 loop 拿到 run，从 prompt 拿到 systemPrompt。",
          en: "The entry file only assembles: take run from loop, systemPrompt from prompt.",
        },
        code: {
          file: "src/index.ts",
          language: "ts",
          snippet: `import { run } from "./loop.js";
import { systemPrompt } from "./prompt.js";`,
          highlightLines: [1, 2],
        },
      },
      {
        title: { zh: "Step 2 · 从命令行参数构造初始消息", en: "Step 2 · Build the first message from argv" },
        desc: {
          zh: "把命令行第一个参数当作用户的任务，包成第一条消息。",
          en: "Treat the first CLI argument as the user's task and wrap it as the first message.",
        },
        code: {
          file: "src/index.ts",
          language: "ts",
          snippet: `const messages = [{ role: "user", content: process.argv[2] ?? "say hello" }];`,
          highlightLines: [1],
        },
      },
      {
        title: { zh: "Step 3 · 启动循环", en: "Step 3 · Kick off the loop" },
        desc: {
          zh: "把 messages 和 systemPrompt 交给 run，循环接管一切。到此，一个迷你 agent 就能跑了。",
          en: "Hand messages + systemPrompt to run and the loop takes over. That's it — a nano agent is live.",
        },
        code: {
          file: "src/index.ts",
          language: "ts",
          snippet: `await run({ messages, systemPrompt });`,
          highlightLines: [1],
        },
      },
    ],
    deepDive: {
      zh: "真实的 CLI agent 还需要：流式输出（边生成边打印）、彩色日志、子命令（run / chat / exec）、配置文件、会话持久化。但核心永远是这 ~15 行的循环。理解了它，你就理解了 Claude Code、Cursor、Devin 的骨架。",
      en: "A real CLI agent adds streaming, colored logs, subcommands (run / chat / exec), config files, and session persistence. But the core is always this ~15-line loop. Understand it and you understand the skeleton of Claude Code, Cursor, and Devin.",
    },
    references: [
      { title: "Claude Code overview", url: "https://docs.anthropic.com/en/docs/claude-code/overview" },
    ],
    compare: {
      rows: [
        { label: { zh: "形态", en: "Form" }, a: "散落的模块文件", b: "一个可执行 CLI" },
        { label: { zh: "交互", en: "Interaction" }, a: "需要手写测试调用", b: "命令行直接对话" },
      ],
    },
    loc: 8,
    status: "ok",
  },
};

export const sampleCourse: Course = { outline: sampleOutline, lessons: sampleLessons };
