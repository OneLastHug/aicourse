from __future__ import annotations

from typing import Any

from app.core.config import Settings
from app.services.cache import Cache
from app.services.codex_driver import CliCodexDriver
from app.services.pipeline.analyze import run_analyze_stage
from app.services.pipeline.curriculum import run_curriculum_stage
from app.services.pipeline.lesson import run_lesson_stage
from app.services.pipeline.run_types import ProgressCallback
from app.services.pipeline.spine import emit_zh_spine_events
from app.services.pipeline.translate import run_translate_stage
from app.services.pipeline.validate import (
    CourseValidationError,
    validate_course_alignment,
    validate_course_schema,
    validate_zh_course_alignment,
    validate_zh_course_schema,
)
from app.services.repo import ingest_repo


async def run_pipeline(
    repo_url: str,
    on_progress: ProgressCallback,
    settings: Settings,
) -> dict[str, Any]:
    """Chinese-first real Python pipeline.

    Browser-facing APIs stay stable. Internally the generation stages now match
    the TypeScript v2 contract: Chinese outline and lessons are generated first,
    validated, then translated into the final bilingual Course JSON.
    """

    await on_progress({"type": "stage", "stage": "ingest", "label": "Cloning & mapping the repo"})
    ctx = await ingest_repo(repo_url, settings)
    cache = Cache.from_settings(settings)
    driver = CliCodexDriver(settings)

    await on_progress(
        {
            "type": "log",
            "level": "info",
            "message": f"repo ingested: {ctx.name}@{ctx.sha} · {len(ctx.tree)} files · {ctx.loc} LOC",
        }
    )

    await on_progress({"type": "stage", "stage": "analyze", "label": "Deep-reading the actual codebase"})
    analysis = await run_analyze_stage(ctx=ctx, driver=driver, cache=cache, settings=settings)

    await on_progress({"type": "stage", "stage": "curriculum", "label": "Designing the layered curriculum"})
    zh_outline = await run_curriculum_stage(
        ctx=ctx,
        analysis=analysis,
        driver=driver,
        cache=cache,
        settings=settings,
    )

    await on_progress({"type": "stage", "stage": "lessons", "label": "Writing the Chinese course"})
    await on_progress(
        {
            "type": "plan",
            "total": len(zh_outline.lessons),
            "lessons": [
                {
                    "id": lesson.id,
                    "title": {"zh": lesson.title, "en": ""},
                    "difficulty": lesson.difficulty,
                }
                for lesson in zh_outline.lessons
            ],
        }
    )
    zh_lessons = await run_lesson_stage(
        ctx=ctx,
        outline=zh_outline,
        driver=driver,
        cache=cache,
        settings=settings,
        on_progress=on_progress,
    )

    await on_progress({"type": "stage", "stage": "spine", "label": "Materializing the runnable spine"})
    await emit_zh_spine_events(zh_lessons, on_progress)

    await on_progress({"type": "stage", "stage": "validate1", "label": "Chinese course schema validation"})
    issues = validate_zh_course_schema(zh_outline, zh_lessons)
    if issues:
        await on_progress({"type": "validation", "round": 1, "passed": False, "issueCount": len(issues)})
        await on_progress({"type": "log", "level": "error", "message": "; ".join(issues)})
        raise CourseValidationError("; ".join(issues))
    await on_progress({"type": "validation", "round": 1, "passed": True, "issueCount": 0})

    await on_progress({"type": "stage", "stage": "validate2", "label": "Repository alignment validation"})
    issues = validate_zh_course_alignment(zh_outline, zh_lessons, ctx)
    if issues:
        await on_progress({"type": "validation", "round": 2, "passed": False, "issueCount": len(issues)})
        await on_progress({"type": "log", "level": "warn", "message": "; ".join(issues)})
    else:
        await on_progress({"type": "validation", "round": 2, "passed": True, "issueCount": 0})

    await on_progress({"type": "stage", "stage": "translate", "label": "Translating the Chinese course to English"})
    course = await run_translate_stage(
        ctx=ctx,
        zh_outline=zh_outline,
        zh_lessons=zh_lessons,
        driver=driver,
        cache=cache,
        settings=settings,
    )
    issues = validate_course_schema(course)
    if issues:
        await on_progress({"type": "log", "level": "error", "message": "; ".join(issues)})
        raise CourseValidationError("; ".join(issues))
    alignment_issues = validate_course_alignment(course, ctx)
    if alignment_issues:
        await on_progress({"type": "log", "level": "warn", "message": "; ".join(alignment_issues)})

    await on_progress({"type": "stage", "stage": "done", "label": "Done"})
    return course.model_dump(mode="json", exclude_none=True)
