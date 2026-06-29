from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.services.cache import Cache
from app.services.pipeline.call import CodexDriverLike, codex_json
from app.services.pipeline.prompts import analyze_prompt
from app.services.repo import RepoContext


async def run_analyze_stage(
    *,
    ctx: RepoContext,
    driver: CodexDriverLike,
    cache: Cache,
    settings: Settings,
) -> dict[str, Any]:
    key = cache.key(
        {
            "stage": "analyze-v1",
            "repo": ctx.url,
            "sha": ctx.sha,
            "model": settings.r2l_codex_model,
            "effort": settings.r2l_codex_reasoning_effort,
        }
    )
    cached = cache.get(key)
    if cached is not None:
        return dict(cached)

    analysis = await codex_json(
        driver=driver,
        label="analyze",
        prompt=analyze_prompt(ctx),
        cwd=Path(ctx.localPath),
        model=dict[str, Any],
    )
    cache.set(key, analysis)
    return analysis

