# Repo2Learn · 计划书 (Project Plan)

> 把任意 Git 仓库，变成一个像 [learn.shareai.run](https://learn.shareai.run/en/s01/) 一样精美、分层、可交互、中英双语的教程网站。
> 仓库扫描 → 分层拆解 → codex 子 agent 填充内容 → 渲染成 Next.js 站点。

---

## 0. 一句话定义

**Repo2Learn** 是一个编排引擎：输入一个仓库链接，调用 **codex**（模型 `gpt-5.5`，思考强度 `xhigh`，子 agent 并发上限 **5**）扫描仓库并检索网络信息，把项目“从 0 到 1”拆成一组**分层递进**的知识点（对标参考站的 `s01 → s02 → … → sN`），再由并发子 agent 结合项目本身的真实代码填充每个知识点的正文，最终渲染成一个可交互、中英双语的 Next.js 教程站。

---

## 1. 参考站分析（learn.shareai.run）

通过抓取参考站结构，确认其核心范式：

| 维度 | 做法 | 我们要复刻的点 |
|---|---|---|
| **分层结构** | 一季（season）拆成 `s01..sN`，每节只讲一个机制，层层递进（`s01 → s02 → … → s20`） | 自动分层：把仓库拆成“由浅入深”的有序知识点序列 |
| **单课模板** | 每节固定区块：`The Problem` → `How It Works`（Step 1..N）→ `Code` → `Deep Dive` → `Compare` → `Simulate` | 统一的**知识点 JSON 契约**，渲染成同样的区块 |
| **交互** | 步骤模拟器（点 Step 高亮代码行）、LOC 统计、左右对比、进度轨道 | 同款交互组件（步骤模拟、LOC、Compare、ProgressRail） |
| **多语言 / 主题** | 中 / 英 / 日切换、深浅色 | 中英双语 + 深浅色（先做 zh/en） |

**关键启发**：参考站每个机制都配**真实可运行的精简代码**（“102 LOC”），所以我们的子 agent 必须从仓库里摘取**真实代码片段**，而不是凭空编造。

---

## 2. 系统架构

```
                ┌──────────────────────── Repo2Learn Orchestrator (TypeScript) ────────────────────────┐
                │                                                                                  │
  repo URL ──►  │  Stage 0          Stage 1                Stage 2                  Stage 3           │  ──► Next.js 站点
                │  Repo Ingest  ──► Architect  ──► ┌─► Lesson Agent (s01) ──┐ ──►  Render              │      (中英双语 / 可交互)
                │  (clone/树/      (分层拆解       ├─► Lesson Agent (s02) ──┤       (生成站点数据)      │
                │   LOC/语言)       s01..sN)       ├─► Lesson Agent (s03) ──┤                          │
                │                                   └─►   … 并发 ≤ 5  …     ┘                          │
                │                                         每 agent: 结合真实代码 + Web 检索增强          │
                └────────────────────────────────────  codex exec · gpt-5.5 · xhigh  ─────────────────────┘
```

### 2.1 四个阶段

**Stage 0 — Repo Ingest（本地，不调 codex 或仅一次轻量调用）**
- `git clone --depth 1`（或对本地路径直接扫描）。
- 采集：文件树（尊重 `.gitignore`）、`README`、`package.json`/`pyproject.toml` 等清单、按语言的文件分布、总 LOC、入口文件、目录功能聚类。
- 产出 `RepoContext`：仓库指纹（commit sha）、摘要、关键文件清单、语言占比、LOC。

**Stage 1 — Architect 分层拆解（单次 codex 调用，深度思考）**
- 给 architect agent 喂入 `RepoContext`（树 + 关键文件摘录 + README），要求它：
  1. 理解项目是做什么的、解决什么问题；
  2. 用 Web 检索补全领域背景（官方文档 / 最佳实践）；
  3. 产出**有序、由浅入深**的知识点大纲 `s01..sN`，每点含：`id`、中英标题、`theProblem`（一句话痛点）、`objective`（学完会什么）、`keyFiles`（讲这节要用到的真实文件）、`prereq`（前置知识点 id）、`difficulty`。
- 产出 `Outline`（严格 JSON 契约，见 §4）。

**Stage 2 — Lesson Content Fill（并发子 agent，≤ 5）**
- 对每个知识点派一个 codex 子 agent，并发用信号量限制为 **5**。
- 子 agent 工作目录 = 仓库本地副本，可直接读 `keyFiles` 里的真实代码；并被要求**联网检索**官方文档/原理资料丰富 `deepDive`。
- 每个子 agent 产出一份 `Lesson`（中英双语）：`problem`、`howItWorks[]`（每步含 `code` 真实片段 + 行高亮 + 中英解说）、`deepDive`、`compare`、`loc`、`tags`。
- 单课失败不影响整体：重试 1 次，仍失败则标记 `failed` 并在站点上标注（断点续跑时可补跑）。

**Stage 3 — Render（本地，纯 TS，不调 codex）**
- 把 `Outline + Lessons` 渲染成 Next.js 站点的数据文件（JSON/TS），写入 `site/`。
- 站点侧负责所有视觉与交互。

### 2.2 codex 集成方案

- 调用方式：非交互 `codex exec`（本地 CLI，依赖用户机器上已登录的 codex / ChatGPT 凭证）。
- 关键参数（全部可配置，默认即用户指定值）：
  - `--model gpt-5.5`
  - reasoning effort `xhigh`（经 codex 的 config override 传入，如 `-c model_reasoning_effort=xhigh`；按本机 codex 版本微调）
  - 工作目录 `-C <repo path>`（让 agent 读真实文件）
  - `--output-last-message <file>` 或解析 stdout 拿最后一条消息
  - 沙箱/权限按需放开，允许联网与只读文件访问
- **输出契约**：要求 agent 仅返回一段严格 JSON（带 schema 校验 + 容错抽取，见 §4.3），解析失败则重试。
- **并发**：自研轻量 `pLimit(n)` 信号量，`n=5`，全局复用。
- **驱动可替换**：`CodexDriver` 接口下有 `CliCodexDriver`（真实）与 `MockCodexDriver`（离线/测试用），保证无 codex 环境也能跑通全链路。

> 说明：codex 不在当前开发沙箱内，因此端到端真跑只能在用户机器上验证；但流水线逻辑、并发、缓存、解析、渲染、站点全部可在沙箱内用 mock driver + 样例数据完整跑通并截图验证。

### 2.3 缓存 / 断点续跑

- 以 `hash(stage + repoSha + prompt 版本 + model + 参数)` 为 key，结果落盘到 `.repo2learn/cache/`。
- 重跑时命中即跳过，支持“只补跑失败/新增的知识点”，对长流程友好。
- 强制重算：`--no-cache`。

### 2.4 Web 信息增强

- architect 与 lesson agent 的 prompt 内置“请检索官方文档与权威资料”指令，依赖 codex 自带联网能力。
- 每条外部引用要求给出标题+链接，渲染为 Deep Dive 末尾的“延伸阅读”。

---

## 3. 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 编排引擎 | **Node.js + TypeScript**（ESM，原生 `child_process` + 自研并发） | 用户指定；类型安全；与站点同语言 |
| codex 调用 | `codex exec` CLI（子进程） | 用户指定 gpt-5.5 / xhigh |
| 并发控制 | 自研 `pLimit` 信号量（≤5） | 无重依赖、可控、可测 |
| 缓存 | 文件系统 + 内容哈希 | 简单可靠、易断点续跑 |
| 教程站点 | **Next.js (App Router) + Tailwind + next-intl** | 复刻参考站观感；SSG 静态导出可双击打开 |
| 代码高亮 | Shiki / Prism | 真实代码片段高亮 + 行高亮 |
| 测试 | Node 内置 `node:test` + `tsx` | 零外部测试依赖 |

---

## 4. 数据契约（JSON Schema 摘要）

### 4.1 RepoContext
```jsonc
{
  "url": "...", "sha": "abc123", "name": "nano-agent", "defaultBranch": "main",
  "summary": "中英各一段",
  "loc": 1024, "languages": { "TypeScript": 0.8, "MDX": 0.2 },
  "tree": ["src/index.ts", "..."],
  "keyFiles": [ { "path": "src/index.ts", "role": "entry", "excerpt": "..." } ]
}
```

### 4.2 Outline（分层大纲）
```jsonc
{
  "course": { "title": { "zh": "...", "en": "..." }, "tagline": {...}, "repo": {...} },
  "lessons": [
    { "id": "s01", "title": {"zh":"...","en":"..."}, "difficulty": "beginner",
      "theProblem": {"zh":"...","en":"..."}, "objective": {"zh":"...","en":"..."},
      "keyFiles": ["src/index.ts"], "prereq": [], "loc": 0 }
  ]
}
```

### 4.3 Lesson（单课正文，中英双语）
```jsonc
{
  "id": "s01",
  "problem": {"zh":"...","en":"..."},
  "howItWorks": [
    { "title":{"zh":"...","en":"..."}, "desc":{"zh":"...","en":"..."},
      "code": { "file":"src/index.ts", "language":"ts",
                "snippet":"...", "highlightLines":[3,4] } }
  ],
  "deepDive": {"zh":"...","en":"...", "references":[{"title":"...","url":"..."}]},
  "compare": { "rows": [ {"label":{"zh":"...","en":"..."}, "a":"...", "b":"..."} ] },
  "loc": 102, "tags": ["tool-use"]
}
```

> 渲染层只认这三个契约 → 编排层和站点层完全解耦，便于单测与离线渲染。

---

## 5. 目录结构

```
repo2learn/
├─ PLAN.md                    # 本计划书
├─ README.md                  # 快速开始 / 如何用真实 codex 跑
├─ package.json               # 根（编排引擎 + workspaces: site）
├─ tsconfig.json
├─ src/                       # 编排引擎（TS）
│  ├─ index.ts                # CLI 入口：repo2learn <url> [opts]
│  ├─ config.ts               # 配置加载/默认值（model/effort/concurrency=5）
│  ├─ types.ts                # RepoContext / Outline / Lesson 类型
│  ├─ codex/
│  │  ├─ driver.ts            # CodexDriver 接口
│  │  ├─ cli-driver.ts        # 真实 codex exec 调用
│  │  ├─ mock-driver.ts       # 离线/测试桩
│  │  └─ parse.ts             # 严格 JSON 抽取 + schema 校验
│  ├─ util/
│  │  ├─ concurrency.ts       # pLimit(5) 信号量
│  │  ├─ cache.ts             # 哈希缓存 / 断点续跑
│  │  ├─ repo.ts              # Stage 0 ingest
│  │  └─ log.ts
│  ├─ prompts/
│  │  ├─ architect.ts         # 分层拆解 prompt
│  │  └─ lesson.ts            # 单课填充 prompt
│  ├─ pipeline/
│  │  ├─ outline.ts           # Stage 1
│  │  ├─ content.ts           # Stage 2（并发 ≤5）
│  │  ├─ render.ts            # Stage 3（写站点数据）
│  │  └─ run.ts               # 全流程编排
│  └─ sample/                 # 离线样例生成器（无需 codex）
├─ site/                      # Next.js 站点（复刻参考站）
│  ├─ app/[locale]/...        # 首页 + 单课页 + 布局
│  ├─ components/             # ProgressRail/StepSimulator/CodeBlock/Compare/...
│  ├─ content/                # 渲染产物（JSON），含 samples
│  └─ package.json
├─ config/
│  └─ repo2learn.config.ts    # 示例配置
├─ samples/                   # 样例仓库快照 + 预生成大纲/课程（站点开箱即用）
└─ tests/                     # node:test 单测
```

---

## 6. 里程碑

| # | 里程碑 | 验收 |
|---|---|---|
| **M1** | 计划书 + 脚手架（工程骨架、配置、类型、CLI 骨架） | `tsc` 通过；`repo2learn --help` 可用 |
| **M2** | codex 驱动 + 并发 + 解析（真实/ mock 双驱动） | 单测：并发≤5、JSON 容错解析、缓存命中 |
| **M3** | 四阶段流水线 + prompt + 缓存/续跑 | 用 mock driver 跑通“仓库→大纲→课程→数据”全链路 |
| **M4** | Next.js 站点（双语/主题/分层 UI/交互组件） | `npm run build` 通过；样例数据渲染截图达标 |
| **M5** | 样例数据 + 端到端离线演示 + 文档 | 双击打开站点即看到精美分层教程；README 说明如何接真实 codex |

> 真实 codex 端到端验证（M3+）在用户机器执行；本沙箱用 mock + 样例覆盖全部可验证路径。

---

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| codex 输出非严格 JSON | 容错抽取（代码块/裸 JSON）+ schema 校验 + 失败重试 1 次 |
| 单课超时/失败 | 单点隔离 + 重试 + 标记 failed + 断点续跑补跑 |
| codex 版本/参数差异 | model/effort/并发/二进制路径全可配置；默认值=用户指定 |
| 仓库过大/噪声多 | ingest 阶段裁剪（.gitignore、大小/类型阈值、只取关键文件摘录） |
| 联网检索不可用 | deepDive 的 references 为可选；不阻塞主流程 |
| 双语成本翻倍 | 单 agent 一次性产出 zh+en（一次推理），而非跑两遍 |

---

## 8. 验证方案

1. **类型与单测**：`tsc --noEmit`；`node:test` 覆盖并发限流、缓存命中、JSON 容错解析、渲染产物结构。
2. **离线端到端**：mock driver + 样例仓库 → 生成大纲与课程 → 渲染站点数据。
3. **站点构建与截图**：`npm run build`（SSG）；对首页与单课页截图，核对分层轨道、步骤模拟、双语切换、深浅色。
4. **真实 codex 冒烟（用户机器）**：README 给出命令；对一个小仓库跑 architect 阶段，确认大纲 JSON 合法。

---

## 9. 约定（沿用用户指定）

- 子 agent 并发上限：**5**
- 模型：**gpt-5.5**
- 思考强度：**xhigh**
- 语言：**中英双语**
- 站点形态：**完整 Next.js 复刻**
- 编排语言：**Node.js / TypeScript**

---

*下一步：按里程碑 M1→M5 开始开发。*
