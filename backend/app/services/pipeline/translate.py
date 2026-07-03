from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.core.schemas import Course, Lesson, Outline, ZhLesson, ZhOutline, ZhOutlineLesson
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
            "stage": "translate-course-v3",
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

    async def translate_one(outline_lesson) -> tuple[str, Lesson]:
        zh_lesson = zh_lessons.get(outline_lesson.id)
        if zh_lesson is None:
            return outline_lesson.id, missing_lesson(outline_lesson.id, "missing Chinese lesson body")
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
            "stage": "translate-outline-v3",
            "repo": ctx.url,
            "sha": ctx.sha,
            "outline": zh_outline.model_dump(mode="json", exclude_none=True),
            "model": settings.r2l_codex_model,
            "effort": settings.r2l_codex_reasoning_effort,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        outline = Outline.model_validate(_normalize_translated_outline_payload(cached, zh_outline))
        outline.lessons = [lesson for section in outline.sections for lesson in section.lessons]
        return outline

    raw_outline = await codex_json(
        driver=driver,
        label="translate:outline",
        prompt=translate_outline_prompt(json_for_prompt(zh_outline)),
        cwd=Path(ctx.localPath),
        model=dict[str, Any],
        settings=settings,
    )
    outline = Outline.model_validate(_normalize_translated_outline_payload(raw_outline, zh_outline))
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
            "stage": "translate-lesson-v3",
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
        settings=settings,
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


def _normalize_translated_outline_payload(payload: dict[str, Any], zh_outline: ZhOutline) -> dict[str, Any]:
    lesson_fallbacks = {lesson.id: _fallback_outline_lesson(lesson) for lesson in zh_outline.lessons}
    lesson_objects: dict[str, dict[str, Any]] = {}
    if isinstance(payload.get("course"), dict):
        payload["course"] = _fallback_course_info(zh_outline) | payload["course"]

    for item in payload.get("lessons", []):
        lesson = _coerce_outline_lesson(item, lesson_fallbacks)
        if lesson is not None:
            lesson_objects[lesson["id"]] = lesson

    for section in payload.get("sections", []):
        if not isinstance(section, dict):
            continue
        normalized_lessons = []
        for item in section.get("lessons", []):
            lesson = _coerce_outline_lesson(item, lesson_fallbacks | lesson_objects)
            if lesson is not None:
                lesson_objects[lesson["id"]] = lesson
                normalized_lessons.append(lesson)
        section["lessons"] = normalized_lessons

    payload["lessons"] = [lesson for section in payload.get("sections", []) for lesson in section.get("lessons", [])]
    return payload


def _coerce_outline_lesson(
    item: Any,
    lesson_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    if isinstance(item, str):
        return lesson_by_id.get(item)
    if not isinstance(item, dict):
        return None
    lesson = dict(item)
    lesson_id = lesson.get("id")
    if not isinstance(lesson_id, str) or not lesson_id:
        return None
    fallback = lesson_by_id.get(lesson_id)
    if fallback is not None:
        lesson = fallback | lesson
    if "keyFiles" not in lesson and "filesToRead" in lesson:
        lesson["keyFiles"] = lesson["filesToRead"]
    return lesson


def _fallback_outline_lesson(lesson: ZhOutlineLesson) -> dict[str, Any]:
    fallback: dict[str, Any] = {
        "id": lesson.id,
        "title": {"zh": lesson.title, "en": lesson.title},
        "difficulty": lesson.difficulty,
        "theProblem": {"zh": lesson.theProblem, "en": lesson.theProblem},
        "objective": {"zh": lesson.objective, "en": lesson.objective},
        "keyFiles": list(lesson.filesToRead),
        "prereq": list(lesson.prereq),
        "tags": list(lesson.tags),
    }
    for field in ("mechanism", "whyNow", "missingBefore", "nextPressure"):
        value = getattr(lesson, field)
        if value is not None:
            fallback[field] = {"zh": value, "en": value}
    return fallback


def _fallback_course_info(outline: ZhOutline) -> dict[str, Any]:
    course = outline.course
    fallback: dict[str, Any] = {
        "title": {"zh": course.title, "en": course.title},
        "tagline": {"zh": course.tagline, "en": course.tagline},
        "repo": course.repo.model_dump(mode="json"),
    }
    for field in ("spine", "thesis", "audience", "whyThisOrder", "learningOutcome"):
        value = getattr(course, field)
        if value is not None:
            fallback[field] = {"zh": value, "en": value}
    if course.conceptInventory:
        fallback["conceptInventory"] = [
            {"zh": item, "en": item}
            for item in course.conceptInventory
        ]
    for field in ("projectArchetype", "primaryMode", "secondaryModes", "globalViews"):
        value = getattr(course, field)
        if value is not None:
            fallback[field] = value
    return fallback


def json_for_prompt(value: ZhOutline | ZhLesson) -> str:
    return json.dumps(value.model_dump(mode="json", exclude_none=True), ensure_ascii=False, indent=2)
