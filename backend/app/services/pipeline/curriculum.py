from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.core.schemas import ZhOutline
from app.prompts.curriculum import curriculum_prompt
from app.services.cache import Cache
from app.services.pipeline.call import CodexDriverLike, codex_json
from app.services.repo import RepoContext


async def run_curriculum_stage(
    *,
    ctx: RepoContext,
    analysis: dict[str, Any],
    driver: CodexDriverLike,
    cache: Cache,
    settings: Settings,
) -> ZhOutline:
    """Generate the Chinese-first layered outline."""

    key = cache.key(
        {
            "stage": "curriculum-zh-v1",
            "repo": ctx.url,
            "sha": ctx.sha,
            "analysis": analysis,
            "model": settings.r2l_codex_model,
            "effort": settings.r2l_codex_reasoning_effort,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        return normalize_outline(ZhOutline.model_validate(cached))

    outline = await codex_json(
        driver=driver,
        label="curriculum",
        prompt=curriculum_prompt(ctx, analysis),
        cwd=Path(ctx.localPath),
        model=ZhOutline,
    )
    normalized = normalize_outline(outline)
    cache.set(key, normalized.model_dump(mode="json", exclude_none=True))
    return normalized


def normalize_outline(outline: ZhOutline) -> ZhOutline:
    """Normalize ids and flattened lessons like the TypeScript pipeline."""

    counter = 0
    flattened = []
    for section_index, section in enumerate(outline.sections, start=1):
        section.id = f"l{section_index:02d}"
        normalized_section_lessons = []
        for lesson in section.lessons:
            counter += 1
            lesson.id = f"s{counter:02d}"
            lesson.prereq = [item for item in lesson.prereq if item.startswith("s")]
            lesson.tags = lesson.tags or []
            lesson.filesToRead = lesson.filesToRead or []
            normalized_section_lessons.append(lesson)
            flattened.append(lesson)
        section.lessons = normalized_section_lessons
    outline.lessons = flattened
    return outline
