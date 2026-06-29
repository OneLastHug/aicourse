# AICourse Python 后端改造计划书

日期：2026-06-29

## 1. 背景与目标

当前项目是一个 TypeScript 课程生成引擎加 Next.js 全栈站点。用户侧体验已经成型，包括首页输入仓库地址、后端生成课程、SSE 实时进度、课程页、lesson 页、中英双语、深浅色主题、交互式代码讲解等。

本次改造目标是：

- 将后端能力迁移到 Python 技术栈。
- 前端 UI、页面布局、交互流程尽量不改。
- 保持现有功能不变，包括生成任务、SSE 进度、失败重试、课程渲染、旧课程访问。
- 保持现有 API 路径和 JSON 数据结构，降低前端改造成本。
- 为后续更稳定的任务队列、数据库持久化和部署运维打基础。

## 2. 当前项目后端边界

当前项目不是传统的前后端分离结构，而是由 Next.js API Routes 和根目录 TypeScript pipeline 共同承担后端职责。

### 2.1 TypeScript 生成引擎

```text
src/
├─ index.ts
├─ types.ts
├─ config.ts
├─ codex/
│  ├─ driver.ts
│  ├─ cli-driver.ts
│  ├─ mock-driver.ts
│  ├─ parse.ts
│  └─ guards.ts
├─ pipeline/
│  ├─ run.ts
│  ├─ analyze.ts
│  ├─ curriculum.ts
│  ├─ spine.ts
│  ├─ lesson.ts
│  ├─ validate.ts
│  ├─ translate.ts
│  └─ render.ts
├─ prompts/
└─ util/
```

主要职责：

- clone / ingest repo
- 调用本机 `codex exec`
- 生成课程分析、课程大纲、spine、lessons
- 校验课程正确性和仓库对齐性
- 中英双语翻译
- 输出最终 `Course` JSON

### 2.2 Next.js 站点中的后端代码

```text
site/app/api/
├─ generate/route.ts
├─ dashboard/route.ts
├─ courses/route.ts
└─ jobs/[id]/
   ├─ route.ts
   ├─ stream/route.ts
   └─ lessons/[lessonId]/route.ts

site/lib/server/
├─ generate.ts
├─ jobs.ts
└─ store.ts
```

主要职责：

- HTTP API
- SSE 实时进度流
- 任务创建、去重、运行状态管理
- failed job 自动重试
- stale job 自动清理
- 课程文件和 job record 的读写
- 调用根目录 TypeScript pipeline

### 2.3 前端依赖的 API

前端客户端组件当前直接依赖以下 API：

```text
POST /api/generate
GET  /api/dashboard
GET  /api/courses
GET  /api/jobs/:id
GET  /api/jobs/:id/stream
GET  /api/jobs/:id/lessons/:lessonId
```

课程页面目前是 Next Server Component，直接从本地文件读取课程：

```text
site/app/[locale]/page.tsx
site/app/[locale]/c/[repoId]/page.tsx
site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx
```

这些页面通过 `site/lib/server/store.ts` 中的 `getCourse()` / `listCourses()` 读取 `data/courses/*`。

## 3. 改造原则

### 3.1 API 合同保持不变

浏览器继续请求：

```text
/api/generate
/api/dashboard
/api/courses
/api/jobs/:id
/api/jobs/:id/stream
/api/jobs/:id/lessons/:lessonId
```

前端组件中的 `fetch("/api/...")` 和 `new EventSource("/api/...")` 不需要改。

### 3.2 Course JSON 结构保持不变

Python 后端必须输出与当前 `src/types.ts` 中 `Course` 类型兼容的 JSON：

```json
{
  "outline": {
    "course": {},
    "archDiagram": {},
    "sections": [],
    "lessons": []
  },
  "lessons": {}
}
```

课程页和 lesson 页依赖该结构渲染 UI。字段名、嵌套结构和中英双语字段都应保持兼容。

### 3.3 ProgressEvent 结构保持不变

SSE 和 job history 使用同样的事件结构：

```json
{ "type": "stage", "stage": "ingest", "label": "Cloning & mapping the repo" }
{ "type": "plan", "total": 10, "lessons": [] }
{ "type": "lesson", "id": "s01", "status": "ok" }
{ "type": "lessonDraft", "id": "s01", "body": {} }
{ "type": "spine", "id": "s01", "status": "ok" }
{ "type": "log", "level": "info", "message": "..." }
{ "type": "error", "message": "..." }
```

### 3.4 前端 UI 不动，取数层可小改

优先不动：

- `site/components/*`
- 课程页 JSX
- lesson 页 JSX
- Tailwind 样式
- 中英文路由
- 页面交互逻辑

允许小范围调整：

- `site/next.config.mjs`：增加 `/api/*` rewrite。
- `site/app/api/*`：改成代理，或逐步移除。
- `site/lib/server/store.ts`：阶段二可改成从 Python API 获取课程。

### 3.5 先兼容文件存储，再考虑数据库

第一阶段继续使用当前文件布局，避免迁移历史课程：

```text
data/
├─ courses/
│  └─ {repoId}/
│     ├─ course.json
│     └─ meta.json
├─ jobs/
│  └─ {jobId}.json
├─ repos/
└─ cache/
```

第二阶段稳定后再考虑 SQLite 或 Postgres。

## 4. 推荐 Python 技术栈

| 能力 | 推荐选型 |
|---|---|
| Web 框架 | FastAPI |
| ASGI Server | uvicorn |
| 生产进程 | systemd，或 gunicorn + uvicorn worker |
| 数据模型 | pydantic |
| SSE | FastAPI StreamingResponse，或 sse-starlette |
| 异步子进程 | asyncio.create_subprocess_exec |
| 文件 IO | aiofiles，可选 |
| Git 操作 | subprocess 调用 git，必要时用 GitPython |
| 测试 | pytest, pytest-asyncio, httpx |
| 格式化和检查 | ruff, mypy 可选 |
| 依赖管理 | uv 或 poetry，简单起步可用 requirements.txt |

第一阶段任务管理可以使用单进程 `asyncio` 内存任务表。后续如果需要多 worker 或水平扩展，再引入 Redis + Celery/RQ/Arq。

## 5. 目标架构

```text
Browser
  |
  | pages, static assets, UI
  v
Next.js frontend
  |
  | /api/*, unchanged from browser perspective
  v
FastAPI backend
  ├─ API routes
  ├─ SSE stream
  ├─ job manager
  ├─ course store
  ├─ repo ingest
  ├─ cache
  ├─ codex driver
  └─ course generation pipeline
```

生产部署建议：

```text
Caddy / Nginx
  ├─ /api/* -> FastAPI 127.0.0.1:8000
  └─ /*     -> Next.js 127.0.0.1:3000
```

本地开发建议：

```text
Next.js dev server  :3000
FastAPI backend     :8000
```

Next 中通过 `PY_BACKEND_URL=http://127.0.0.1:8000` 指向 Python 后端。

## 6. Python 后端目录设计

建议新增：

```text
backend/
├─ app/
│  ├─ main.py
│  ├─ api/
│  │  ├─ generate.py
│  │  ├─ dashboard.py
│  │  ├─ courses.py
│  │  └─ jobs.py
│  ├─ core/
│  │  ├─ config.py
│  │  ├─ events.py
│  │  └─ schemas.py
│  ├─ services/
│  │  ├─ store.py
│  │  ├─ jobs.py
│  │  ├─ generator.py
│  │  ├─ codex_driver.py
│  │  ├─ repo.py
│  │  ├─ cache.py
│  │  └─ pipeline/
│  │     ├─ run.py
│  │     ├─ analyze.py
│  │     ├─ curriculum.py
│  │     ├─ spine.py
│  │     ├─ lesson.py
│  │     ├─ validate.py
│  │     └─ translate.py
│  ├─ prompts/
│  └─ sample/
├─ tests/
├─ pyproject.toml
└─ README.md
```

## 7. 模块迁移映射

| 当前 TypeScript 文件 | Python 目标模块 |
|---|---|
| `src/types.ts` | `backend/app/core/schemas.py` |
| `site/lib/server/store.ts` | `backend/app/services/store.py` |
| `site/lib/server/jobs.ts` | `backend/app/services/jobs.py` |
| `site/lib/server/generate.ts` | `backend/app/services/generator.py` |
| `src/codex/cli-driver.ts` | `backend/app/services/codex_driver.py` |
| `src/codex/mock-driver.ts` | `backend/app/services/codex_driver.py` |
| `src/codex/parse.ts` | `backend/app/services/json_parse.py` |
| `src/util/repo.ts` | `backend/app/services/repo.py` |
| `src/util/cache.ts` | `backend/app/services/cache.py` |
| `src/pipeline/run.ts` | `backend/app/services/pipeline/run.py` |
| `src/pipeline/analyze.ts` | `backend/app/services/pipeline/analyze.py` |
| `src/pipeline/curriculum.ts` | `backend/app/services/pipeline/curriculum.py` |
| `src/pipeline/spine.ts` | `backend/app/services/pipeline/spine.py` |
| `src/pipeline/lesson.ts` | `backend/app/services/pipeline/lesson.py` |
| `src/pipeline/validate.ts` | `backend/app/services/pipeline/validate.py` |
| `src/pipeline/translate.ts` | `backend/app/services/pipeline/translate.py` |
| `src/prompts/*.ts` | `backend/app/prompts/*.py` |

## 8. API 合同

### 8.1 POST `/api/generate`

请求：

```json
{
  "repoUrl": "https://github.com/owner/repo"
}
```

已生成课程：

```json
{
  "ready": true,
  "repoId": "repo-xxxxxx"
}
```

已有运行任务或创建新任务：

```json
{
  "ready": false,
  "id": "job-id",
  "repoId": "repo-xxxxxx"
}
```

错误：

```json
{
  "error": "repoUrl is required"
}
```

### 8.2 GET `/api/dashboard`

响应：

```json
{
  "running": [
    {
      "id": "job-id",
      "repoId": "repo-xxxxxx",
      "repoUrl": "https://github.com/owner/repo",
      "stage": "lessons",
      "lessonsDone": 3,
      "lessonsTotal": 10,
      "startedAt": 1710000000000
    }
  ],
  "failed": [
    {
      "id": "job-id",
      "repoId": "repo-xxxxxx",
      "repoUrl": "https://github.com/owner/repo",
      "errorMsg": "error message",
      "updatedAt": 1710000000000,
      "stage": "validate1",
      "lessonsDone": 3,
      "lessonsTotal": 10
    }
  ],
  "courses": [
    {
      "repoId": "repo-xxxxxx",
      "url": "https://github.com/owner/repo",
      "name": "repo",
      "title": "Course title",
      "createdAt": "2026-06-29T00:00:00.000Z",
      "lessonCount": 10
    }
  ]
}
```

### 8.3 GET `/api/courses`

响应：

```json
{
  "courses": []
}
```

### 8.4 GET `/api/jobs/:id`

响应：

```json
{
  "id": "job-id",
  "repoUrl": "https://github.com/owner/repo",
  "repoId": "repo-xxxxxx",
  "status": "running",
  "stage": "lessons",
  "lessonsTotal": 10,
  "lessonsDone": 3,
  "events": [],
  "startedAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### 8.5 GET `/api/jobs/:id/stream`

SSE 响应示例：

```text
data: {"type":"stage","stage":"ingest","label":"Cloning & mapping the repo"}

data: {"type":"plan","total":10,"lessons":[]}

: ping
```

响应头：

```http
content-type: text/event-stream; charset=utf-8
cache-control: no-cache, no-transform
connection: keep-alive
x-accel-buffering: no
```

### 8.6 GET `/api/jobs/:id/lessons/:lessonId`

响应：

```json
{
  "id": "s01",
  "problem": "...",
  "howItWorks": []
}
```

未就绪时：

```json
{
  "error": "draft not ready"
}
```

### 8.7 可选新增 GET `/api/courses/:repoId`

如果第二阶段把课程页面也切到 Python API，可新增：

```json
{
  "outline": {},
  "lessons": {}
}
```

## 9. 实施阶段

### 阶段 0：冻结合同和建立基线

目标：明确不能破坏的行为。

工作内容：

- 整理 API contract 文档。
- 整理 `Course` JSON schema。
- 整理 `ProgressEvent` schema。
- 使用当前 TypeScript 版本在 `R2L_MOCK=1` 下生成一份样例课程。
- 对当前接口做快照测试。

交付物：

```text
docs/python-backend-contract.md
docs/course-schema.example.json
docs/progress-events.example.json
```

验收标准：

- 明确前端依赖的全部字段。
- 有一份可对比的当前行为基线。

### 阶段 1：搭建 FastAPI 后端骨架

目标：Python 后端先提供同名 API，但 pipeline 使用 mock。

工作内容：

- 新建 `backend/`。
- 添加 FastAPI app。
- 添加配置模块。
- 用 Pydantic 定义核心 schema。
- 实现 mock 版 API。
- 实现 mock SSE 事件流。

关键配置：

```bash
R2L_DATA_DIR=/var/lib/aicourse
R2L_MOCK=1
R2L_CODEX_BINARY=codex
R2L_CODEX_MODEL=gpt-5.5
R2L_CODEX_REASONING_EFFORT=xhigh
R2L_CODEX_CONCURRENCY=5
```

交付物：

```text
backend/app/main.py
backend/app/core/config.py
backend/app/core/schemas.py
backend/app/api/*.py
backend/tests/test_api_contract.py
```

验收标准：

- `R2L_MOCK=1 uvicorn app.main:app` 可启动。
- 首页能启动 mock 生成任务。
- 进度页能收到 SSE。
- UI 无变化。

### 阶段 2：迁移文件存储 store

目标：Python 后端能读写当前 `data/` 文件结构。

工作内容：

- 实现 `repo_id_for(url)`，必须与当前 TypeScript `repoIdFor` 结果一致。
- 实现课程读写。
- 实现 job record 读写。
- 实现课程列表。
- 实现 repo clone 和 course 删除。
- 对坏 JSON 做容错。

关键函数：

```text
repo_id_for(url)
save_course(repo_id, course, meta)
get_course(repo_id)
get_meta(repo_id)
list_courses()
remove_course(repo_id)
save_job_record(record)
get_job_record(id)
list_job_records()
remove_job_record(id)
remove_repo_clone(repo_url)
```

交付物：

```text
backend/app/services/store.py
backend/tests/test_store.py
```

验收标准：

- Python 能读取已有 `data/courses/*/course.json`。
- Python 写出的 `course.json` 可被现有 Next 页面渲染。
- 同一个 repo URL 算出的 `repoId` 与旧版一致。

### 阶段 3：迁移 job manager

目标：替换 `site/lib/server/jobs.ts`。

工作内容：

- 实现内存 job table。
- 实现 `repoId -> running jobId` 去重。
- 实现 job 创建、查询、运行。
- 实现事件缓冲和 SSE replay。
- 实现 lesson draft 存储。
- 实现 persisted job record。
- 实现服务启动 reconcile。
- 实现 auto retry。
- 实现 auto cleanup。

关键行为：

- 已生成课程直接返回 `ready: true`。
- 同一个 repo 已有 running job 时复用 job id。
- 服务重启后，历史 running job 标记为 error。
- failed job 在 24 小时内可自动重试。
- stale job 超过 24 小时清理。

交付物：

```text
backend/app/services/jobs.py
backend/tests/test_jobs.py
```

验收标准：

- dashboard running/failed/courses 正常。
- SSE 可回放历史事件。
- retry 行为与当前一致。

### 阶段 4：迁移 Codex Driver

目标：Python 能用同样方式调用本机 Codex CLI。

当前调用方式：

```text
codex exec --model gpt-5.5 -c model_reasoning_effort=xhigh -C <repo> --output-last-message <file> "<prompt>"
```

工作内容：

- 定义 `CodexDriver` 抽象。
- 实现 `CliCodexDriver`。
- 实现 `MockCodexDriver`。
- 使用 `asyncio.create_subprocess_exec`。
- 支持 timeout、stdout/stderr 捕获、临时文件读取。
- 迁移 JSON 提取和校验逻辑。
- 对 Codex 失败输出清晰错误。

交付物：

```text
backend/app/services/codex_driver.py
backend/app/services/json_parse.py
backend/app/sample/responder.py
backend/tests/test_codex_driver.py
```

验收标准：

- mock 模式无需 Codex。
- 真实模式能调用本机 `codex exec`。
- Codex 返回非 JSON 时，错误能展示在前端 error 状态中。

### 阶段 5：迁移 repo ingest 与 cache

目标：Python pipeline 能 clone repo、扫描代码、缓存阶段结果。

工作内容：

- 迁移 `dirNameForUrl` 逻辑。
- 实现 repo clone / fetch。
- 获取 commit sha。
- 获取 default branch。
- 统计 LOC 和语言分布。
- 生成 repo tree。
- 实现大文件、二进制文件、无关目录过滤。
- 实现内容寻址 cache。
- 支持 `noCache`。

交付物：

```text
backend/app/services/repo.py
backend/app/services/cache.py
backend/tests/test_repo.py
backend/tests/test_cache.py
```

验收标准：

- 同一仓库生成的 `RepoContext` 与旧版基本一致。
- cache 可命中。
- 失败任务保留 cache 以便 retry。

### 阶段 6：迁移核心 pipeline

目标：把 TypeScript 课程生成 pipeline 迁移到 Python。

迁移顺序：

1. `analyze`
2. `curriculum`
3. `spine`
4. `lesson`
5. `validate`
6. `translate`
7. `run`

工作内容：

- 迁移 prompts。
- 迁移 stage 编排。
- 迁移并发控制，使用 `asyncio.Semaphore`。
- 保持 lessons 阶段并发上限默认 5。
- 保持所有 progress event。
- 保持 validation 逻辑。
- 保持 translation 逻辑。
- 保持失败后的 clone 清理逻辑。

交付物：

```text
backend/app/services/pipeline/*.py
backend/app/prompts/*.py
backend/tests/test_pipeline_mock.py
```

验收标准：

- `R2L_MOCK=1` 可完整生成课程。
- Python 输出的 `course.json` 可被现有课程页渲染。
- SSE 进度页显示正常。
- lesson draft 预览正常。
- 真实 Codex 模式可以完成至少一个小仓库生成。

### 阶段 7：前端接入 Python 后端

目标：让前端实际使用 Python 后端，同时尽量不改 UI。

#### 方案 A：Next rewrite 到 Python 后端

修改 `site/next.config.mjs`：

```js
const backendUrl = process.env.PY_BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

优点：

- 浏览器仍请求 `/api/*`。
- 前端组件无需改。
- 后端职责清晰转移到 Python。

风险：

- 如果现有 `site/app/api/*` 与 rewrite 优先级冲突，需要改用方案 B。

#### 方案 B：Next API route 薄代理

保留 `site/app/api/*`，但实现为转发到 Python。

优点：

- 路由优先级最稳。
- 可以逐个 API 迁移。

缺点：

- SSE 代理需要额外验证。
- Next 仍保留少量后端代理代码。

#### 课程页面取数方案

第一阶段推荐：

- Python 后端写同格式 `course.json`。
- Next 课程页面继续通过 `site/lib/server/store.ts` 读取共享文件。
- UI 和 JSX 不改，风险最低。

第二阶段推荐：

- Python 新增 `GET /api/courses/:repoId`。
- 修改 `site/lib/server/store.ts`，把 `getCourse()` / `listCourses()` 改成请求 Python API。
- 页面 JSX 不改。

### 阶段 8：测试与验收

测试分三层。

#### Python 单元测试

覆盖：

- `repo_id_for`
- store 读写
- job dedupe
- job reconcile
- SSE event serialization
- mock pipeline
- cache
- Codex JSON parse

#### API 合同测试

使用 `httpx` 测：

```text
POST /api/generate
GET  /api/dashboard
GET  /api/courses
GET  /api/jobs/:id
GET  /api/jobs/:id/stream
GET  /api/jobs/:id/lessons/:lessonId
```

重点检查字段名、字段类型和错误响应，不只检查 HTTP 200。

#### 前端回归测试

验证：

- 首页输入 repo URL。
- 已生成课程直接跳转课程页。
- 未生成课程进入进度页。
- SSE 阶段进度正常推进。
- lesson 状态卡片正常。
- lesson draft 预览可打开。
- 失败任务显示 failed 卡片。
- retry 可用。
- 中英文路由保持正常。

关键路由：

```text
/en
/zh
/en/j/:id
/zh/j/:id
/en/c/:repoId
/zh/c/:repoId
/en/c/:repoId/lessons/:id
/zh/c/:repoId/lessons/:id
```

## 10. 部署计划

### 10.1 本地开发

Python 后端：

```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Next 前端：

```bash
cd site
PY_BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

### 10.2 生产部署

建议使用两个 systemd 服务：

```text
aicourse-backend.service  -> FastAPI :8000
aicourse-frontend.service -> Next.js :3000
```

反向代理：

```text
/api/* -> 127.0.0.1:8000
/*     -> 127.0.0.1:3000
```

关键环境变量：

```bash
R2L_DATA_DIR=/var/lib/aicourse
R2L_MOCK=0
R2L_CODEX_BINARY=codex
R2L_CODEX_MODEL=gpt-5.5
R2L_CODEX_REASONING_EFFORT=xhigh
R2L_CODEX_CONCURRENCY=5
PY_BACKEND_URL=http://127.0.0.1:8000
```

后端 systemd 示例：

```ini
[Unit]
Description=AICourse Python Backend
After=network.target

[Service]
WorkingDirectory=/opt/aicourse/backend
Environment=R2L_DATA_DIR=/var/lib/aicourse
Environment=R2L_MOCK=0
ExecStart=/opt/aicourse/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 11. 风险与应对

### 11.1 SSE 代理风险

风险：

- 如果通过 Next API route 代理 SSE，可能出现 buffering、连接提前关闭或 ping 丢失。

应对：

- 生产优先让 Nginx/Caddy 直接把 `/api/jobs/:id/stream` 转发到 FastAPI。
- 保持 `x-accel-buffering: no`。
- 每 15 秒发送 `: ping`。

### 11.2 Course JSON 兼容风险

风险：

- 前端页面对字段有隐式依赖，缺字段会导致页面渲染失败。

应对：

- Pydantic schema 严格对齐 `src/types.ts`。
- mock pipeline 输出完整样例。
- 用真实 Next 页面打开 Python 生成结果做回归。

### 11.3 repoId 不一致风险

风险：

- Python 算出的 `repoId` 如果与旧版不一致，旧课程会找不到。

应对：

- 完全复刻当前 `repoIdFor`：
  - URL 最后一段去 `.git`
  - 非法字符替换为 `-`
  - 最长 40 字符
  - 小写
  - `sha1(url)` 前 6 位作为后缀
- 增加对比测试。

### 11.4 多进程任务状态风险

风险：

- 如果 FastAPI 多 worker 部署，内存 job manager 会在多个进程间不一致。

应对：

- 第一阶段生产使用单 worker。
- 需要多 worker 时，引入 Redis/Celery/RQ/Arq 或数据库锁。

### 11.5 Codex CLI 行为差异风险

风险：

- Python subprocess 的参数、cwd、临时文件、stderr 处理与旧版有差异。

应对：

- 先完全复用旧版 CLI 参数。
- 记录 Codex 调用 debug log。
- 保持 mock 模式作为 CI 和本地联调主路径。

## 12. 推荐实施顺序

1. 建立合同文档和样例数据。
2. 新建 FastAPI backend，mock API 跑通。
3. Python store 兼容当前 `data/` 文件结构。
4. Python job manager 跑通 dashboard、progress、SSE。
5. Next `/api/*` 接到 Python backend，pipeline 暂时 mock。
6. 迁移 Codex driver。
7. 迁移 repo/cache。
8. 迁移 pipeline。
9. 前端用真实 Python pipeline 跑完整生成。
10. 保留 TypeScript 后端一段时间作为回滚路径。
11. 稳定后删除或归档 TypeScript 后端代码。

## 13. 前端预计改动范围

尽量不动：

```text
site/components/*
site/app/[locale]/c/[repoId]/page.tsx 的 JSX
site/app/[locale]/c/[repoId]/lessons/[id]/page.tsx 的 JSX
site/app/[locale]/j/[id]/page.tsx 的 UI 逻辑
site/app/globals.css
```

可能改动：

```text
site/next.config.mjs
site/app/api/*
site/lib/server/store.ts
```

阶段一可以让 `site/lib/server/store.ts` 暂时保留，只读取 Python 写出的共享 `course.json`。阶段二再改成从 Python API 读取课程。

## 14. 里程碑

### M1：Python mock backend 可用

- FastAPI 可启动。
- Next 前端通过 `/api/*` 调 Python。
- 首页、dashboard、生成进度、SSE mock 全通。
- UI 无变化。

### M2：Python store/job manager 可用

- 可读旧课程。
- 可写新 job records。
- running/failed/courses 显示正常。
- retry、cleanup、reconcile 行为对齐旧版。

### M3：Python mock pipeline 输出完整 course.json

- mock 生成课程。
- 课程首页和 lesson 页面正常渲染。
- 中英文内容正常。

### M4：Python Codex pipeline 可真实生成

- 能 clone repo。
- 能调用 codex。
- 能生成 outline、lessons、validate、translate。
- SSE 显示完整过程。
- 失败可重试。

### M5：生产切换

- VPS 上 Python backend + Next frontend 双服务运行。
- `/api/*` 全部由 Python 提供。
- 旧 TypeScript 后端停止使用。
- 观察稳定后再清理旧后端代码。

## 15. 最终验收标准

用户视角必须满足：

- 首页 UI 不变。
- 输入 Git 仓库 URL 的行为不变。
- 已生成课程直接打开课程页。
- 新任务进入实时进度页。
- 进度页阶段、lesson 数、日志、预览、失败重试不变。
- 课程页 UI 不变。
- lesson 页面 UI 不变。
- 中英文路由不变。
- 深浅色主题不变。
- 旧的已生成课程可继续访问。
- `R2L_MOCK=1` 仍可离线联调。
- 生产环境重启后课程不丢失。

## 16. 推荐结论

推荐采用两步走：

第一步，Python 后端先兼容现有文件结构和 API 合同。Next 前端只通过 rewrite 或 proxy 把 `/api/*` 交给 FastAPI。课程页面暂时继续读取同格式 `course.json`，这样 UI 和页面代码几乎不动，风险最低。

第二步，等 Python 后端稳定后，再把课程页面的数据读取也改成 Python API。这样最终后端职责可以完整收敛到 Python，同时仍然保持页面 UI 不变。
