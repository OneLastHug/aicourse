from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.core.config import Settings
from app.core.schemas import Course, Lesson, Outline, ZhLesson, ZhOutline
from app.prompts.translate import translate_lesson_prompt, translate_outline_prompt
from app.services.cache import Cache
from app.services.pipeline.call import CodexDriverLike, codex_json
from app.services.repo import RepoContext


async def run_translate_stage(
    *,
    ctx: RepoContext,
    zh_outline: ZhOutline,
    zh_lessons: dict[str, ZhLesson],
    driver: CodexDriverLike,
    cache: Cache,
    settings: Settings,
) -> Course:
    """Translate the Chinese-first course into the final bilingual Course."""

    key = cache.key(
        {
            "stage": "translate-course-v1",
            "repo": ctx.url,
            "sha": ctx.sha,
            "outline": zh_outline.model_dump(mode="json", exclude_none=True),
            "lessons": {
                lesson_id: lesson.model_dump(mode="json", exclude_none=True)
                for lesson_id, lesson in zh_lessons.items()
            },
            "model": settings.r2l_codex_model,
            "effort": settings.r2l_codex_reasoning_effort,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        course = Course.model_validate(cached)
        flatten_outline(course)
        return course

    outline = await translate_outline(
        ctx=ctx,
        zh_outline=zh_outline,
        driver=driver,
        cache=cache,
        settings=settings,
    )

    semaphore = asyncio.Semaphore(max(1, settings.r2l_codex_concurrency))

    async def translate_one(outline_lesson) -> tuple[str, Lesson]:
        zh_lesson = zh_lessons.get(outline_lesson.id)
        if zh_lesson is None:
            return outline_lesson.id, missing_lesson(outline_lesson.id, "missing Chinese lesson body")
        async with semaphore:
            lesson = await translate_lesson(
                ctx=ctx,
                zh_lesson=zh_lesson,
                driver=driver,
                cache=cache,
                settings=settings,
            )
            return outline_lesson.id, lesson

    lessons = dict(await asyncio.gather(*(translate_one(item) for item in zh_outline.lessons)))

    course = Course(outline=outline, lessons=lessons)
    flatten_outline(course)
    cache.set(key, course.model_dump(mode="json", exclude_none=True))
    return course


async def translate_outline(
    *,
    ctx: RepoContext,
    zh_outline: ZhOutline,
    driver: CodexDriverLike,
    cache: Cache,
    settings: Settings,
) -> Outline:
    key = cache.key(
        {
            "stage": "translate-outline-v1",
            "repo": ctx.url,
            "sha": ctx.sha,
            "outline": zh_outline.model_dump(mode="json", exclude_none=True),
            "model": settings.r2l_codex_model,
            "effort": settings.r2l_codex_reasoning_effort,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        outline = Outline.model_validate(cached)
        outline.lessons = [lesson for section in outline.sections for lesson in section.lessons]
        return outline

    outline = await codex_json(
        driver=driver,
        label="translate:outline",
        prompt=translate_outline_prompt(json_for_prompt(zh_outline)),
        cwd=Path(ctx.localPath),
        model=Outline,
    )
    outline.lessons = [lesson for section in outline.sections for lesson in section.lessons]
    cache.set(key, outline.model_dump(mode="json", exclude_none=True))
    return outline


async def translate_lesson(
    *,
    ctx: RepoContext,
    zh_lesson: ZhLesson,
    driver: CodexDriverLike,
    cache: Cache,
    settings: Settings,
) -> Lesson:
    key = cache.key(
        {
            "stage": "translate-lesson-v1",
            "repo": ctx.url,
            "sha": ctx.sha,
            "lesson": zh_lesson.model_dump(mode="json", exclude_none=True),
            "model": settings.r2l_codex_model,
            "effort": settings.r2l_codex_reasoning_effort,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        return Lesson.model_validate(cached)

    lesson = await codex_json(
        driver=driver,
        label=f"translate:lesson:{zh_lesson.id}",
        prompt=translate_lesson_prompt(zh_lesson.id, json_for_prompt(zh_lesson)),
        cwd=Path(ctx.localPath),
        model=Lesson,
    )
    if lesson.id != zh_lesson.id:
        lesson.id = zh_lesson.id
    lesson.status = "ok"
    cache.set(key, lesson.model_dump(mode="json", exclude_none=True))
    return lesson


def flatten_outline(course: Course) -> None:
    course.outline.lessons = [lesson for section in course.outline.sections for lesson in section.lessons]
    for lesson in course.outline.lessons:
        if lesson.id not in course.lessons:
            course.lessons[lesson.id] = missing_lesson(lesson.id, "missing translated lesson body")


def missing_lesson(lesson_id: str, error: str) -> Lesson:
    return Lesson.model_validate(
        {
            "id": lesson_id,
            "problem": {"zh": "", "en": ""},
            "howItWorks": [],
            "deepDive": {"zh": "", "en": ""},
            "references": [],
            "compare": {"rows": []},
            "loc": 0,
            "status": "failed",
            "error": error,
        }
    )


def json_for_prompt(value: ZhOutline | ZhLesson) -> str:
    return json.dumps(value.model_dump(mode="json", exclude_none=True), ensure_ascii=False, indent=2)
