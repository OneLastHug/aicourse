from __future__ import annotations

import asyncio
from typing import Any

from app.core.config import Settings
from app.core.schemas import Course, ZhLesson, ZhOutline
from app.prompts.lesson import lesson_prompt
from app.services.cache import Cache
from app.services.pipeline.call import CodexDriverLike, codex_json
from app.services.pipeline.run_types import ProgressCallback
from app.services.repo import RepoContext


async def run_lesson_stage(
    *,
    ctx: RepoContext,
    outline: ZhOutline,
    driver: CodexDriverLike,
    cache: Cache,
    settings: Settings,
    on_progress: ProgressCallback,
) -> dict[str, ZhLesson]:
    semaphore = asyncio.Semaphore(max(1, settings.r2l_codex_concurrency))

    async def generate_one(outline_lesson) -> tuple[str, ZhLesson]:
        async with semaphore:
            lesson_id = outline_lesson.id
            key = cache.key(
                {
                    "stage": "lesson-zh-v1",
                    "repo": ctx.url,
                    "sha": ctx.sha,
                    "id": lesson_id,
                    "model": settings.r2l_codex_model,
                    "effort": settings.r2l_codex_reasoning_effort,
                }
            )
            cached = cache.get(key)
            await on_progress({"type": "lesson", "id": lesson_id, "status": "start"})
            if cached is not None:
                lesson = ZhLesson.model_validate(cached)
            else:
                lesson = await codex_json(
                    driver=driver,
                    label=f"lesson:{lesson_id}",
                    prompt=lesson_prompt(ctx, outline, outline_lesson),
                    cwd=ctx.localPath,
                    model=ZhLesson,
                )
                cache.set(key, lesson.model_dump(mode="json", exclude_none=True))
            if lesson.id != lesson_id:
                lesson.id = lesson_id
            await on_progress(
                {
                    "type": "lessonDraft",
                    "id": lesson_id,
                    "body": lesson.model_dump(mode="json", exclude_none=True),
                }
            )
            await on_progress({"type": "lesson", "id": lesson_id, "status": "ok"})
            return lesson_id, lesson

    entries = await asyncio.gather(*(generate_one(item) for item in outline.lessons))
    return dict(entries)


async def emit_lesson_events(course: Course, on_progress: ProgressCallback) -> None:
    outline_lessons = course.outline.lessons
    await on_progress(
        {
            "type": "plan",
            "total": len(outline_lessons),
            "lessons": [
                {
                    "id": lesson.id,
                    "title": lesson.title.model_dump(mode="json"),
                    "difficulty": lesson.difficulty,
                }
                for lesson in outline_lessons
            ],
        }
    )
    course_data: dict[str, Any] = course.model_dump(mode="json", exclude_none=True)
    for lesson in outline_lessons:
        lesson_id = lesson.id
        await on_progress({"type": "lesson", "id": lesson_id, "status": "start"})
        draft = course_data["lessons"].get(lesson_id)
        if draft is not None:
            await on_progress({"type": "lessonDraft", "id": lesson_id, "body": draft})
        await on_progress({"type": "lesson", "id": lesson_id, "status": "ok"})
