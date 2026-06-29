from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from app.core.config import Settings, get_settings
from app.sample.fixtures import build_mock_course
from app.services.pipeline.run import run_pipeline

ProgressCallback = Callable[[dict[str, Any]], Awaitable[None]]


async def generate_course(
    repo_url: str,
    on_progress: ProgressCallback,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Generate a course.

    The first Python migration stage intentionally ships a full mock path. The
    real Codex pipeline should replace the non-mock branch without changing the
    job manager or API routes.
    """

    cfg = settings or get_settings()
    if not cfg.r2l_mock:
        return await run_pipeline(repo_url, on_progress, cfg)

    course = build_mock_course(repo_url)
    lessons = course["outline"]["lessons"]

    await on_progress({"type": "stage", "stage": "ingest", "label": "Cloning & mapping the repo"})
    await asyncio.sleep(0.05)
    await on_progress({"type": "stage", "stage": "analyze", "label": "Deep-reading the actual codebase"})
    await asyncio.sleep(0.05)
    await on_progress({"type": "stage", "stage": "curriculum", "label": "Designing the layered curriculum"})
    await on_progress(
        {
            "type": "plan",
            "total": len(lessons),
            "lessons": [
                {"id": item["id"], "title": item["title"], "difficulty": item["difficulty"]}
                for item in lessons
            ],
        }
    )
    await asyncio.sleep(0.05)

    await on_progress({"type": "stage", "stage": "lessons", "label": f"Writing {len(lessons)} lessons"})
    for item in lessons:
        lesson_id = item["id"]
        await on_progress({"type": "lesson", "id": lesson_id, "status": "start"})
        await asyncio.sleep(0.05)
        await on_progress({"type": "lessonDraft", "id": lesson_id, "body": course["lessons"][lesson_id]})
        await on_progress({"type": "lesson", "id": lesson_id, "status": "ok"})

    await on_progress({"type": "stage", "stage": "spine", "label": "Materializing the runnable spine"})
    for item in lessons:
        await on_progress({"type": "spine", "id": item["id"], "status": "start"})
        await asyncio.sleep(0.03)
        await on_progress({"type": "spine", "id": item["id"], "status": "ok"})

    await on_progress({"type": "stage", "stage": "validate1", "label": "Validation 1 · correctness & poisoning"})
    await on_progress({"type": "validation", "round": 1, "passed": True, "issueCount": 0})
    await asyncio.sleep(0.03)
    await on_progress({"type": "stage", "stage": "validate2", "label": "Validation 2 · alignment with the repo"})
    await on_progress({"type": "validation", "round": 2, "passed": True, "issueCount": 0})
    await asyncio.sleep(0.03)
    await on_progress({"type": "stage", "stage": "translate", "label": "Translating the Chinese course to English"})
    await asyncio.sleep(0.03)
    await on_progress({"type": "stage", "stage": "done", "label": "Done"})

    return course
