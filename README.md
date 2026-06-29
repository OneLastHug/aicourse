# AICourse · Repo2Learn

> 粘贴一个仓库地址，自动把它变成像 [learn.shareai.run](https://learn.shareai.run) 那样**分层、可交互、中英双语**的教程网站。
> 后端用 **codex**（gpt-5.5 / xhigh）拉取并拆解仓库，**并发子 agent（≤5）**结合真实代码逐课编写。

```text
首页输入框 ──► 后端拉取仓库 ──► codex 分层拆解(s01→sN) ──► 并发子agent填充(≤5) ──► 实时进度 ──► 教程页
```

## 它做什么

读源码最痛的不是代码，而是**不知道按什么顺序读、每个模块为什么存在**。AICourse 让 codex 像资深工程师那样，把任意仓库「从 0 到 1」拆成一组**由浅入深**的知识点，每节都结合仓库**真实代码**给出：问题 → 工作原理（分步 + 代码 + 行高亮）→ 深入 → 对比。

## 特性

- 🌐 **全栈 web 应用**：首页输入框 → 后端按需生成 → SSE 实时进度 → 动态课程页。
- 🧠 **codex 编排**：本机 `codex exec`，模型 `gpt-5.5`，思考强度 `xhigh`，子 agent **并发上限 5**。
- 🪜 **分层拆解**：单次 architect 调用产出有序大纲；并发子 agent 逐课填充。
- 💾 **断点续跑 + 持久化**：内容寻址缓存；生成的课程落盘，重启不丢。
- 🌍 **中英双语** + 深浅色主题；交互式步骤模拟器、Shiki 语法高亮、对比表、进度轨道。
- 🧪 **可离线自测**：`R2L_MOCK=1` 用 mock 驱动跑通全链路，无需 codex。

## 本地开发

```bash
npm install
npm -w site run dev      # http://localhost:3000
```

离线联调后端（不调 codex，秒出一份样例课程，用于验证全链路）：

```bash
R2L_MOCK=1 npm -w site run dev     # 首页随便填一个 github 地址即可
```

### Python 后端分支

`python` 分支提供 FastAPI 后端，前端 UI 保持不变，通过 `PY_BACKEND_URL`
把 `/api/*` 转发到 Python 服务：

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
R2L_MOCK=1 uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

cd ../site
PY_BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

`R2L_MOCK=0` 会走 Python repo-ingest/Codex pipeline。API 合同见
[`docs/python-backend-contract.md`](./docs/python-backend-contract.md)，部署说明见
[`docs/python-backend-deploy.md`](./docs/python-backend-deploy.md)。

## 部署到 VPS（Debian + codex）

详见 [`DEPLOY.md`](./DEPLOY.md)。要点：

```bash
npm install
npm -w site run build
R2L_DATA_DIR=/var/lib/aicourse npm -w site run start
```

- codex 必须装在服务器上并登录；用 systemd/pm2 常驻（**不要 serverless**）。
- `R2L_DATA_DIR` 放生成的课程（持久化）；不要设 `R2L_MOCK`（默认即真实 codex）。

## 架构

```
src/                    编排引擎（TypeScript，被站点导入）
├─ index.ts             CLI 入口（可无界面直跑）
├─ types.ts             数据契约 + 进度事件
├─ config.ts            配置（默认 gpt-5.5 / xhigh / 并发 5）
├─ codex/               driver 接口 + 真实 CLI 驱动 + mock 驱动 + JSON 解析/校验
├─ util/                并发限流 · 缓存 · 仓库 ingest · 日志
├─ prompts/             architect（分层）/ lesson（填充）提示词
├─ pipeline/            outline · content(并发≤5) · render · run
└─ sample/              离线样例数据与 mock 响应

site/                   Next.js 全栈站点（App Router + Tailwind + Shiki）
├─ app/
│  ├─ page.tsx          首页（仓库地址输入框）
│  ├─ j/[id]/           生成进度页（SSE）
│  ├─ c/[repoId]/[locale](/lessons/[id])   动态课程页
│  └─ api/              generate · jobs · SSE stream · courses
├─ lib/server/          任务管理 · 课程存储 · 生成编排
└─ components/          Sidebar · StepSimulator · CompareTable · TopBar …

tests/                  node:test 单测（并发 / 缓存 / 解析 / 流水线）
```

## codex 调用

```text
codex exec --model gpt-5.5 -c model_reasoning_effort=xhigh -C <repo> --output-last-message <file> "<prompt>"
```

> 不同 codex 版本参数名可能略有差异，model/effort/并发/二进制路径均可在 `config/repo2learn.config.ts` 或 `src/types.ts` 覆盖。

## 命令一览

| 命令 | 说明 |
|---|---|
| `npm -w site run dev` | Next.js 开发服务器 |
| `npm -w site run build` / `start` | 生产构建 / 启动 |
| `npm run test` | 单元测试（并发 / 缓存 / 解析 / 流水线） |
| `npm run typecheck` | 引擎类型检查 |
| `npm run dev -- <repo>` | 无界面 CLI 直跑（走 codex） |
| `npm run learn:sample` | 无界面 CLI 样例模式 |

## 许可

MIT
