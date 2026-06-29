from __future__ import annotations

import asyncio
from typing import Any, Protocol, TypeVar

from pydantic import BaseModel, TypeAdapter

from app.core.config import Settings, get_settings
from app.services.codex_driver import CodexCall
from app.services.json_parse import extract_json

T = TypeVar("T")


class CodexDriverLike(Protocol):
    async def run(self, call: CodexCall): ...


_generation_limiter: asyncio.Semaphore | None = None
_generation_limiter_size: int | None = None


def get_generation_limiter(settings: Settings | None = None) -> asyncio.Semaphore:
    global _generation_limiter, _generation_limiter_size

    cfg = settings or get_settings()
    size = max(1, cfg.r2l_codex_concurrency)
    if _generation_limiter is None or _generation_limiter_size != size:
        _generation_limiter = asyncio.Semaphore(size)
        _generation_limiter_size = size
    return _generation_limiter


async def codex_json(
    *,
    driver: CodexDriverLike,
    label: str,
    prompt: str,
    cwd,
    model: type[T],
    settings: Settings | None = None,
    attempts: int = 2,
) -> T:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            async with get_generation_limiter(settings):
                result = await driver.run(CodexCall(label=label, prompt=prompt, cwd=cwd))
            parsed = extract_json(result.text)
            if isinstance(model, type) and issubclass(model, BaseModel):
                return model.model_validate(parsed)  # type: ignore[return-value]
            return TypeAdapter(model).validate_python(parsed)
        except Exception as exc:
            last_error = exc
            if attempt == attempts:
                break
            prompt += (
                "\n\nYour previous response did not parse as the required JSON shape. "
                "Return STRICT JSON ONLY. Do not include markdown fences or prose."
            )
    raise RuntimeError(f"{label} failed: {last_error}") from last_error


def ensure_jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json", exclude_none=True)
    return value
