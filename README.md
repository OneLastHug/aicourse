# Repo2Learn

> 把任意 Git 仓库，变成一个像 [learn.shareai.run](https://learn.shareai.run) 一样精美、分层、可交互、中英双语的教程网站。
> 一句命令：仓库链接 → codex 扫描拆解 → 子 agent 填充内容 → Next.js 站点。

```text
repo URL ──► [Stage 0 ingest] ──► [Stage 1 分层大纲] ──► [Stage 2 并发填充 ≤5] ──► [Stage 3 渲染] ──► 站点
```

## 它解决什么问题

读源码最痛苦的不是代码本身，而是**不知道该按什么顺序读、每个模块为什么存在**。Repo2Learn 让 codex 像一位资深工程师那样，把一个仓库「从 0 到 1」拆成一组**由浅入深**的知识点（对标参考站的 `s01 → sNN`），每个知识点都结合仓库里的**真实代码**给出：问题 → 工作原理（分步 + 代码）→ 深入 → 对比。

## 特性

- 🧠 **codex 编排**：调用本地 `codex exec`，模型 `gpt-5.5`，思考强度 `xhigh`，子 agent **并发上限 5**。
- 🧩 **分层拆解**：单次 architect 调用产出有序大纲；并发子 agent 逐课填充。
- 🪜 **断点续跑**：内容寻址缓存，重跑只补未完成/失败的知识点（`--no-cache` 强制重算）。
- 🌐 **联网增强**：子 agent 可检索官方文档，生成 Deep Dive 延伸阅读。
- 🌍 **中英双语** + 深浅色主题，交互式步骤模拟器、行高亮、对比表、进度轨道。
- 🧪 **可离线**：mock codex 驱动 + 样例仓库，无需 codex 也能跑通全链路并渲染站点。

## 快速开始

### 0. 安装依赖

```bash
cd repo2learn
npm install          # 安装编排引擎 + Next.js 站点
# 若 node_modules 来自旧环境导致安装报错，先删除它：rm -rf node_modules（Windows 直接删文件夹）
```

### 1. 离线演示（无需 codex，立刻看效果）

```bash
npm run learn:sample      # 用样例仓库跑全流程，生成站点数据
npm -w site run dev       # 打开 http://localhost:3000
```

### 2. 用真实 codex 跑你的仓库

前提：本机已安装并登录 [codex CLI](https://github.com/openai/codex)（`codex` 在 PATH 中）。

```bash
# 默认即 gpt-5.5 / xhigh / 并发 5
npx tsx src/index.ts https://github.com/your/repo
# 或本地路径
npx tsx src/index.ts ../some-local-project

# 可选覆盖
npx tsx src/index.ts https://github.com/your/repo \
  --concurrency 5 --model gpt-5.5 --effort xhigh --target 12
```

跑完后重新构建站点：

```bash
npm -w site run build && npm -w site start
```

## 命令一览

| 命令 | 说明 |
|---|---|
| `npm run dev` / `npm run start` | 运行编排 CLI（tsx 直跑） |
| `npm run learn:sample` | 离线样例模式 |
| `npm run test` | 单元测试（并发 / 缓存 / 解析 / 流水线） |
| `npm run typecheck` | 类型检查 |
| `npm -w site run dev` | Next.js 开发服务器 |
| `npm -w site run build` | 生产构建 |

## 架构

详见 [`PLAN.md`](./PLAN.md)。

```
src/
├─ index.ts            CLI 入口
├─ config.ts           配置（默认 gpt-5.5 / xhigh / 并发 5）
├─ types.ts            数据契约
├─ codex/              driver 接口 + 真实 CLI 驱动 + mock 驱动 + JSON 解析/校验
├─ util/               并发限流(pLimit) · 缓存 · 仓库 ingest · 日志
├─ prompts/            architect（分层）/ lesson（填充）提示词
├─ pipeline/           outline · content(并发≤5) · render · run
└─ sample/             离线样例数据与 mock 响应
site/                  Next.js 站点（App Router + Tailwind + Shiki）
samples/nano-agent/    样例仓库（演示用）
tests/                 node:test 单测
```

## codex 调用说明

引擎用子进程非交互调用 `codex exec`：

```text
codex exec \
  --model gpt-5.5 \
  -c model_reasoning_effort=xhigh \
  -C <repo-path> \
  --output-last-message <file> \
  "<prompt>"
```

> 不同 codex 版本参数名可能略有差异。model / effort / 并发 / 二进制路径全部可在 [`config/repo2learn.config.ts`](./config/repo2learn.config.ts) 或命令行覆盖。
> codex 不在当前开发沙箱，因此**真实端到端**需在你本机验证；但流水线逻辑、并发、缓存、解析、渲染、站点全部可用 mock + 样例离线验证。

## 配置示例

见 [`config/repo2learn.config.ts`](./config/repo2learn.config.ts)。

## 许可

MIT
