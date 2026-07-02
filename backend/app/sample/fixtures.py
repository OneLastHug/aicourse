from __future__ import annotations

import re
from copy import deepcopy
from typing import Any


def _bi(zh: str, en: str) -> dict[str, str]:
    return {"zh": zh, "en": en}


def repo_name_from_url(repo_url: str) -> str:
    base = next((part for part in reversed(re.split(r"[/\:]", repo_url)) if part), "repo")
    return re.sub(r"\.git$", "", base)


def build_mock_course(repo_url: str) -> dict[str, Any]:
    """Build a small but frontend-complete Course object.

    This is intentionally not a loose placeholder: it exercises the fields used
    by the existing course homepage, lesson page, sidebar, progress rail,
    simulator, Mermaid rendering, compare table, references, and try-it blocks.
    """

    repo_name = repo_name_from_url(repo_url)
    lessons = [
        {
            "id": "s01",
            "title": _bi("Repository Entry Point", "Repository Entry Point"),
            "difficulty": "beginner",
            "theProblem": _bi(
                "读一个新仓库时，最先卡住的是不知道从哪里进入。",
                "When reading a new repository, the first blocker is not knowing where to enter.",
            ),
            "objective": _bi(
                "定位入口文件，并理解请求如何进入系统。",
                "Locate the entry point and understand how requests enter the system.",
            ),
            "mechanism": _bi("入口到主流程", "entry to main flow"),
            "whyNow": _bi("先建立地图，再看细节。", "Build the map before looking at details."),
            "missingBefore": _bi("还没有统一的阅读顺序。", "There is no reading order yet."),
            "nextPressure": _bi(
                "入口清楚后，需要理解状态如何保存。",
                "After the entry is clear, state persistence becomes the next question.",
            ),
            "keyFiles": ["README.md", "src/index.ts"],
            "prereq": [],
            "tags": ["entry", "flow"],
        },
        {
            "id": "s02",
            "title": _bi("State and Jobs", "State and Jobs"),
            "difficulty": "beginner",
            "theProblem": _bi(
                "长任务不能只靠一次 HTTP 请求完成，需要可查询、可恢复的状态。",
                "Long-running work cannot live inside one HTTP request; it needs queryable, recoverable state.",
            ),
            "objective": _bi(
                "理解任务记录、进度事件和课程文件之间的关系。",
                "Understand the relationship between job records, progress events, and course files.",
            ),
            "mechanism": _bi("任务状态机", "job state machine"),
            "whyNow": _bi(
                "生成过程已经启动，必须能观察它。",
                "Once generation starts, it must be observable.",
            ),
            "missingBefore": _bi("入口只说明如何开始。", "The entry point only explains how to start."),
            "nextPressure": _bi(
                "有状态后，下一步是把结果渲染成课程。",
                "With state in place, the next step is rendering the result as a course.",
            ),
            "keyFiles": ["site/lib/server/jobs.ts", "site/lib/server/store.ts"],
            "prereq": ["s01"],
            "tags": ["jobs", "state"],
        },
    ]

    course: dict[str, Any] = {
        "outline": {
            "course": {
                "title": _bi(f"{repo_name} Code Reading Course", f"{repo_name} Code Reading Course"),
                "tagline": _bi(
                    "从入口、状态到渲染，按真实执行路径读懂仓库。",
                    "Read the repository by following the real execution path: entry, state, rendering.",
                ),
                "repo": {"url": repo_url, "name": repo_name, "sha": "mock"},
                "spine": _bi(
                    "一条从请求进入到课程落盘的最小主线。",
                    "A minimal path from request entry to persisted course output.",
                ),
                "thesis": _bi(
                    "读仓库时先找主流程，再把细节挂到主流程上。",
                    "Read the main flow first, then attach details to it.",
                ),
                "audience": _bi(
                    "想快速建立项目全局模型的开发者。",
                    "Developers who want to quickly build a project-level mental model.",
                ),
                "whyThisOrder": _bi(
                    "先知道请求从哪来，再理解状态为何存在。",
                    "First learn where requests enter, then why state exists.",
                ),
            },
            "archDiagram": {
                "kind": "mermaid",
                "caption": _bi("生成流程总览", "Generation flow overview"),
                "diagram": (
                    'flowchart LR\n'
                    '  form["Home form"] --> api["/api/generate"]\n'
                    '  api --> job["Job manager"]\n'
                    '  job --> course["course.json"]\n'
                    '  job --> sse["SSE progress"]'
                ),
            },
            "sections": [
                {
                    "id": "l01",
                    "title": _bi("Main Flow", "Main Flow"),
                    "summary": _bi(
                        "先读懂用户请求、任务状态和课程输出之间的主链路。",
                        "First understand the main chain from user request to job state and course output.",
                    ),
                    "spine": _bi(
                        "首页提交 -> 后端任务 -> 课程落盘。",
                        "Home submit -> backend job -> persisted course.",
                    ),
                    "role": _bi(
                        "建立可运行系统的骨架视图。",
                        "Build a skeleton view of the running system.",
                    ),
                    "transitionIn": _bi(
                        "从页面上的一个仓库 URL 开始。",
                        "Start from one repository URL on the page.",
                    ),
                    "transitionOut": _bi(
                        "主线清楚后，再逐步替换成真实 Codex pipeline。",
                        "Once the main line is clear, replace the mock path with the real Codex pipeline.",
                    ),
                    "lessons": lessons,
                }
            ],
            "lessons": lessons,
        },
        "lessons": {
            "s01": {
                "id": "s01",
                "principle": _bi(
                    "入口文件把用户动作变成系统动作。",
                    "The entry point turns a user action into a system action.",
                ),
                "teachingScope": _bi(
                    "只讲请求进入和任务创建，不展开真实 Codex 提示词。",
                    "Focus on request entry and job creation, not the real Codex prompts yet.",
                ),
                "problem": _bi(
                    "如果不知道请求从哪里进入，后续任何模块都像孤岛。",
                    "Without knowing where the request enters, every module feels isolated.",
                ),
                "solution": _bi(
                    "保持 `/api/generate` 合同不变，把实现迁到 Python。",
                    "Keep the `/api/generate` contract stable while moving the implementation to Python.",
                ),
                "diagram": {
                    "kind": "mermaid",
                    "caption": _bi("入口请求", "Entry request"),
                    "diagram": 'flowchart LR\n  browser["Browser"] --> generate["POST /api/generate"] --> job["Job"]',
                },
                "spine": {
                    "lessonId": "s01",
                    "path": "s01_entry/code.py",
                    "language": "py",
                    "code": (
                        "async def generate(req):\n"
                        "    repo_url = req.repoUrl.strip()\n"
                        "    job_id = job_manager.create(repo_url)\n"
                        "    return {'ready': False, 'id': job_id}\n"
                    ),
                    "runCmd": "python -m app.main",
                    "addedLines": [],
                },
                "howItWorks": [
                    {
                        "title": _bi("Receive the Repository URL", "Receive the Repository URL"),
                        "desc": _bi(
                            "请求体仍然只需要 `repoUrl`，这样前端表单无需改变。",
                            "The request body still only needs `repoUrl`, so the frontend form does not change.",
                        ),
                        "code": {
                            "file": "backend/app/api/generate.py",
                            "language": "py",
                            "snippet": "payload = await request.json()\nrepo_url = payload.get('repoUrl', '').strip()",
                            "highlightLines": [1, 2],
                            "isSpine": True,
                        },
                    },
                    {
                        "title": _bi("Create a Job", "Create a Job"),
                        "desc": _bi(
                            "后端返回 job id，进度页继续通过 SSE 监听。",
                            "The backend returns a job id, and the progress page keeps listening over SSE.",
                        ),
                        "code": {
                            "file": "backend/app/services/jobs.py",
                            "language": "py",
                            "snippet": "job_id = job_manager.create(repo_url, repo_id)\nreturn {'ready': False, 'id': job_id, 'repoId': repo_id}",
                            "highlightLines": [1, 2],
                            "isSpine": True,
                        },
                    },
                ],
                "deepDive": _bi(
                    "## 为什么先守住 API\n迁移后端时，最容易破坏的是前端和后端之间的隐式合同。这里先保持 `/api/generate` 的请求和响应不变，等 Python 后端稳定后再替换内部生成逻辑。\n\n## 迁移边界\n前端仍然只关心 `ready`、`id` 和 `repoId`，不需要知道后端是 TypeScript 还是 Python。",
                    "## Why keep the API first\nDuring a backend migration, the easiest thing to break is the implicit contract between frontend and backend. This step keeps the `/api/generate` request and response stable, then replaces the internal generation logic once the Python backend is stable.\n\n## Migration boundary\nThe frontend still only cares about `ready`, `id`, and `repoId`; it does not need to know whether the backend is TypeScript or Python.",
                ),
                "deepSource": _bi(
                    "当前 TypeScript 版本的同名接口位于 `site/app/api/generate/route.ts`。Python 版本应复刻它的校验、去重和响应结构。",
                    "The current TypeScript endpoint lives at `site/app/api/generate/route.ts`. The Python version should mirror its validation, deduplication, and response structure.",
                ),
                "sourceCompare": {
                    "simplified": _bi("mock Python 后端", "mock Python backend"),
                    "real": _bi("完整 Codex pipeline", "full Codex pipeline"),
                    "gaps": [
                        {
                            "dimension": _bi("生成内容", "generated content"),
                            "simplified": _bi("固定样例课程", "fixed sample course"),
                            "real": _bi("读取真实仓库并调用 Codex", "read the real repo and call Codex"),
                            "whySimplified": _bi(
                                "先验证 API 和 UI 合同。",
                                "Validate the API and UI contract first.",
                            ),
                        }
                    ],
                },
                "tryIt": {
                    "commands": [_bi("R2L_MOCK=1 uvicorn app.main:app --port 8000", "R2L_MOCK=1 uvicorn app.main:app --port 8000")],
                    "observe": [_bi("前端仍然跳转到同一个进度页。", "The frontend still navigates to the same progress page.")],
                },
                "whatsNext": _bi(
                    "入口稳定后，下一步要看长任务的状态如何保存和展示。",
                    "After the entry is stable, the next step is how long-running job state is stored and displayed.",
                ),
                "references": [
                    {
                        "title": "FastAPI documentation",
                        "url": "https://fastapi.tiangolo.com/",
                        "kind": "official",
                        "whyUsed": _bi("Python API 框架参考", "Python API framework reference"),
                    }
                ],
                "compare": {"rows": [{"label": _bi("合同", "Contract"), "a": "changed", "b": "stable"}]},
                "loc": 24,
                "badges": {"loc": 24, "difficulty": "beginner", "concepts": ["api", "migration"]},
                "status": "ok",
            },
            "s02": {
                "id": "s02",
                "principle": _bi(
                    "长任务必须外化成可查询的状态。",
                    "Long-running work must be externalized into queryable state.",
                ),
                "teachingScope": _bi(
                    "只讲单进程任务管理，不展开 Redis/Celery。",
                    "Focus on single-process job management, not Redis/Celery yet.",
                ),
                "problem": _bi(
                    "生成课程需要数分钟，请求不能一直阻塞在表单提交里。",
                    "Course generation can take minutes; the submit request cannot block until completion.",
                ),
                "solution": _bi(
                    "任务立即返回 id，进度通过 `/api/jobs/:id/stream` 推送。",
                    "Return a job id immediately and push progress through `/api/jobs/:id/stream`.",
                ),
                "diagram": {
                    "kind": "mermaid",
                    "caption": _bi("任务状态", "Job state"),
                    "diagram": 'stateDiagram-v2\n  [*] --> running\n  running --> done\n  running --> error',
                },
                "spine": {
                    "lessonId": "s02",
                    "path": "s02_jobs/code.py",
                    "language": "py",
                    "code": (
                        "job.events.append(event)\n"
                        "for queue in job.subscribers:\n"
                        "    queue.put_nowait(event)\n"
                        "save_job_record(job.state)\n"
                    ),
                    "runCmd": "python -m app.main",
                    "addedLines": [1, 2, 3, 4],
                    "prevLessonId": "s01",
                },
                "howItWorks": [
                    {
                        "title": _bi("Persist the Summary", "Persist the Summary"),
                        "desc": _bi(
                            "job record 只保存仪表盘需要的摘要，课程本体单独写入 `course.json`。",
                            "The job record stores dashboard summary data; the course body is written separately to `course.json`.",
                        ),
                        "code": {
                            "file": "backend/app/services/store.py",
                            "language": "py",
                            "snippet": "save_job_record(job.state)\nsave_course(repo_id, course, meta)",
                            "highlightLines": [1, 2],
                            "isSpine": True,
                        },
                    },
                    {
                        "title": _bi("Push Events", "Push Events"),
                        "desc": _bi(
                            "SSE 连接先回放历史事件，再订阅后续事件。",
                            "The SSE connection replays historical events first, then subscribes to new ones.",
                        ),
                        "code": {
                            "file": "backend/app/services/jobs.py",
                            "language": "py",
                            "snippet": "for event in job.state.events:\n    yield sse(event)\nasync for event in subscribe(job_id):\n    yield sse(event)",
                            "highlightLines": [1, 2, 3, 4],
                            "isSpine": True,
                        },
                    },
                ],
                "deepDive": _bi(
                    "## 为什么要持久化 job record\n首页需要显示 running、failed 和 completed 列表。即使进程重启，已完成课程也应能继续显示；正在运行的任务则要被标记为中断，避免用户以为它还在跑。\n\n## 当前阶段的取舍\n第一阶段使用单进程内存队列，部署时应使用单 worker。需要横向扩展时，再把队列和事件迁移到 Redis 或数据库。",
                    "## Why persist job records\nThe home page needs running, failed, and completed lists. Completed courses should remain visible after restart; running jobs should be marked interrupted so users do not think they are still active.\n\n## Current-stage trade-off\nThe first stage uses an in-memory queue in a single process. Production should use one worker. When horizontal scaling is needed, move queues and events to Redis or a database.",
                ),
                "deepSource": _bi(
                    "当前 TypeScript 任务管理位于 `site/lib/server/jobs.ts`，Python 版本先对齐其状态、去重和清理行为。",
                    "The current TypeScript job manager lives at `site/lib/server/jobs.ts`; the Python version first mirrors its state, dedupe, and cleanup behavior.",
                ),
                "sourceCompare": {
                    "simplified": _bi("单进程 asyncio", "single-process asyncio"),
                    "real": _bi("未来队列后端", "future queue backend"),
                    "gaps": [
                        {
                            "dimension": _bi("扩展性", "scalability"),
                            "simplified": _bi("单 worker", "single worker"),
                            "real": _bi("多 worker + Redis/DB", "multi-worker + Redis/DB"),
                            "whySimplified": _bi(
                                "先保持迁移面可控。",
                                "Keep the migration surface controlled first.",
                            ),
                        }
                    ],
                },
                "tryIt": {
                    "commands": [_bi("curl http://127.0.0.1:8000/api/dashboard", "curl http://127.0.0.1:8000/api/dashboard")],
                    "observe": [_bi("任务从 running 变成 done。", "The job moves from running to done.")],
                },
                "whatsNext": _bi(
                    "状态稳定后，就可以逐步把 mock 生成替换成真实 Codex pipeline。",
                    "Once state is stable, the mock generator can be replaced by the real Codex pipeline.",
                ),
                "references": [],
                "compare": {"rows": [{"label": _bi("状态", "State"), "a": "request-local", "b": "persistent record"}]},
                "loc": 32,
                "badges": {"loc": 32, "difficulty": "beginner", "concepts": ["sse", "jobs", "state"]},
                "status": "ok",
            },
        },
    }

    return deepcopy(course)
