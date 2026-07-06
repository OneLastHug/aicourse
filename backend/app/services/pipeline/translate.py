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
    cache_bust: str | None = None,
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
            "cacheBust": cache_bust,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        course = Course.model_validate(cached)
        flatten_outline(course)
        return course

    if not settings.r2l_translate_with_codex:
        course = Course(
            outline=fallback_outline_from_zh(zh_outline),
            lessons={
                lesson_id: fallback_lesson_from_zh(lesson)
                for lesson_id, lesson in zh_lessons.items()
            },
        )
        flatten_outline(course)
        cache.set(key, course.model_dump(mode="json", exclude_none=True))
        return course

    outline = await translate_outline(
        ctx=ctx,
        zh_outline=zh_outline,
        driver=driver,
        cache=cache,
        settings=settings,
        cache_bust=cache_bust,
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
            cache_bust=cache_bust,
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
    cache_bust: str | None = None,
) -> Outline:
    key = cache.key(
        {
            "stage": "translate-outline-v3",
            "repo": ctx.url,
            "sha": ctx.sha,
            "outline": zh_outline.model_dump(mode="json", exclude_none=True),
            "model": settings.r2l_codex_model,
            "effort": settings.r2l_codex_reasoning_effort,
            "cacheBust": cache_bust,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        outline = Outline.model_validate(_normalize_translated_outline_payload(cached, zh_outline))
        outline.lessons = [lesson for section in outline.sections for lesson in section.lessons]
        return outline

    try:
        raw_outline = await codex_json(
            driver=driver,
            label="translate:outline",
            prompt=translate_outline_prompt(json_for_prompt(zh_outline)),
            cwd=Path(ctx.localPath),
            model=dict[str, Any],
            settings=settings,
        )
        outline = Outline.model_validate(_normalize_translated_outline_payload(raw_outline, zh_outline))
    except RuntimeError:
        outline = fallback_outline_from_zh(zh_outline)
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
    cache_bust: str | None = None,
) -> Lesson:
    key = cache.key(
        {
            "stage": "translate-lesson-v3",
            "repo": ctx.url,
            "sha": ctx.sha,
            "lesson": zh_lesson.model_dump(mode="json", exclude_none=True),
            "model": settings.r2l_codex_model,
            "effort": settings.r2l_codex_reasoning_effort,
            "cacheBust": cache_bust,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        return Lesson.model_validate(cached)

    try:
        lesson = await codex_json(
            driver=driver,
            label=f"translate:lesson:{zh_lesson.id}",
            prompt=translate_lesson_prompt(zh_lesson.id, json_for_prompt(zh_lesson)),
            cwd=Path(ctx.localPath),
            model=Lesson,
            settings=settings,
        )
    except RuntimeError:
        lesson = fallback_lesson_from_zh(zh_lesson)
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


def fallback_outline_from_zh(zh_outline: ZhOutline) -> Outline:
    """Build a valid bilingual outline if Codex translation is unavailable."""

    sections: list[dict[str, Any]] = []
    for section in zh_outline.sections:
        section_payload: dict[str, Any] = {
            "id": section.id,
            "title": _bi(section.title),
            "summary": _bi(section.summary),
            "lessons": [_fallback_outline_lesson(lesson) for lesson in section.lessons],
        }
        for field in ("spine", "role", "transitionIn", "transitionOut"):
            value = getattr(section, field)
            if value is not None:
                section_payload[field] = _bi(value)
        sections.append(section_payload)

    payload: dict[str, Any] = {
        "course": _fallback_course_info(zh_outline),
        "sections": sections,
        "lessons": [lesson for section in sections for lesson in section["lessons"]],
    }
    if zh_outline.archDiagram is not None:
        payload["archDiagram"] = {
            "kind": zh_outline.archDiagram.kind,
            "caption": _bi(zh_outline.archDiagram.caption),
            "diagram": zh_outline.archDiagram.diagram,
        }
    outline = Outline.model_validate(payload)
    outline.lessons = [lesson for section in outline.sections for lesson in section.lessons]
    return outline


def fallback_lesson_from_zh(zh_lesson: ZhLesson) -> Lesson:
    """Build a valid bilingual lesson if Codex translation is unavailable."""

    payload: dict[str, Any] = {
        "id": zh_lesson.id,
        "problem": _bi(zh_lesson.problem),
        "howItWorks": [_fallback_step(step) for step in zh_lesson.howItWorks],
        "deepDive": _bi(zh_lesson.deepDive),
        "references": [_fallback_reference(reference) for reference in zh_lesson.references],
        "compare": {
            "rows": [
                {"label": _bi(row.label), "a": row.a, "b": row.b}
                for row in zh_lesson.compare.rows
            ]
        },
        "loc": zh_lesson.loc,
        "status": zh_lesson.status,
    }
    for field in ("principle", "teachingScope", "solution", "deepSource", "whatsNext", "error"):
        value = getattr(zh_lesson, field)
        if value is not None:
            payload[field] = _bi(value) if field != "error" else value
    if zh_lesson.diagram is not None:
        payload["diagram"] = {
            "kind": zh_lesson.diagram.kind,
            "caption": _bi(zh_lesson.diagram.caption),
            "diagram": zh_lesson.diagram.diagram,
        }
    for field in ("spine", "badges"):
        value = getattr(zh_lesson, field)
        if value is not None:
            payload[field] = _dump(value)
    if zh_lesson.sourceCompare is not None:
        payload["sourceCompare"] = {
            "gaps": [
                {
                    "dimension": _bi(gap.dimension),
                    "simplified": _bi(gap.simplified),
                    "real": _bi(gap.real),
                    "whySimplified": _bi(gap.whySimplified),
                }
                for gap in zh_lesson.sourceCompare.gaps
            ]
        }
        if zh_lesson.sourceCompare.simplified is not None:
            payload["sourceCompare"]["simplified"] = _bi(zh_lesson.sourceCompare.simplified)
        if zh_lesson.sourceCompare.real is not None:
            payload["sourceCompare"]["real"] = _bi(zh_lesson.sourceCompare.real)
    if zh_lesson.simulation is not None:
        payload["simulation"] = {
            "kind": zh_lesson.simulation.kind,
            "title": _bi(zh_lesson.simulation.title),
            "steps": [
                {
                    "label": _bi(step.label),
                    "state": _bi(step.state),
                    "detail": _bi(step.detail),
                }
                for step in zh_lesson.simulation.steps
            ],
        }
    if zh_lesson.practice is not None:
        payload["practice"] = [
            {
                "title": _bi(task.title),
                "prompt": _bi(task.prompt),
                "check": _bi(task.check),
            }
            for task in zh_lesson.practice
        ]
    if zh_lesson.tryIt is not None:
        payload["tryIt"] = {
            "commands": [_bi(item) for item in zh_lesson.tryIt.commands],
            "observe": [_bi(item) for item in zh_lesson.tryIt.observe],
        }
        if zh_lesson.tryIt.setup is not None:
            payload["tryIt"]["setup"] = [_bi(item) for item in zh_lesson.tryIt.setup]
    return Lesson.model_validate(payload)


def _fallback_step(step) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": _bi(step.title),
        "desc": _bi(step.desc),
    }
    for field in ("code", "beforeCode"):
        value = getattr(step, field)
        if value is not None:
            payload[field] = _dump(value)
    if step.anatomy is not None:
        payload["anatomy"] = _bi(step.anatomy)
    return payload


def _fallback_reference(reference) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": reference.title,
        "url": reference.url,
    }
    if reference.kind is not None:
        payload["kind"] = reference.kind
    if reference.whyUsed is not None:
        payload["whyUsed"] = _bi(reference.whyUsed)
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


def _bi(value: str) -> dict[str, str]:
    return {"zh": value, "en": value}


def _dump(value) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", exclude_none=True)
    return value


def json_for_prompt(value: ZhOutline | ZhLesson) -> str:
    return json.dumps(value.model_dump(mode="json", exclude_none=True), ensure_ascii=False, indent=2)
