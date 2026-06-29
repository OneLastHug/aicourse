from __future__ import annotations

from app.core.schemas import Course, ZhLesson
from app.services.pipeline.run_types import ProgressCallback


async def emit_spine_events(course: Course, on_progress: ProgressCallback) -> None:
    """Emit spine progress for lessons that include runnable spine artifacts."""

    for lesson_id, lesson in course.lessons.items():
        if lesson.spine is None:
            continue
        await on_progress({"type": "spine", "id": lesson_id, "status": "start"})
        await on_progress({"type": "spine", "id": lesson_id, "status": "ok"})


async def emit_zh_spine_events(lessons: dict[str, ZhLesson], on_progress: ProgressCallback) -> None:
    """Emit spine progress from Chinese lesson drafts before translation."""

    for lesson_id, lesson in lessons.items():
        if lesson.spine is None:
            continue
        await on_progress({"type": "spine", "id": lesson_id, "status": "start"})
        await on_progress({"type": "spine", "id": lesson_id, "status": "ok"})
