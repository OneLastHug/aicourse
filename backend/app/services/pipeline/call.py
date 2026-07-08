from __future__ import annotations

import asyncio
from typing import Any, Protocol, TypeVar

from pydantic import BaseModel, TypeAdapter

from app.core.config import Settings, get_settings
from app.services.codex_driver import CodexCall
from app.services.json_parse import extract_json
from app.services.observability import current_observability, safe_exception

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
    obs = current_observability()
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        obs.event(
            "codex_json.attempt",
            metadata={"label": label, "attempt": attempt, "attempts": attempts},
        )
        try:
            async with get_generation_limiter(settings):
                result = await driver.run(CodexCall(label=label, prompt=prompt, cwd=cwd))
            try:
                parsed = extract_json(result.text)
            except Exception as exc:
                obs.event(
                    "codex_json.error",
                    metadata={
                        "label": label,
                        "attempt": attempt,
                        "phase": "json_parse",
                        "error": safe_exception(exc, obs.capture),
                    },
                )
                raise
            try:
                if isinstance(model, type) and issubclass(model, BaseModel):
                    value = model.model_validate(parsed)  # type: ignore[assignment]
                else:
                    value = TypeAdapter(model).validate_python(parsed)
            except Exception as exc:
                obs.event(
                    "codex_json.error",
                    metadata={
                        "label": label,
                        "attempt": attempt,
                        "phase": "schema_validate",
                        "error": safe_exception(exc, obs.capture),
                    },
                )
                raise
            obs.event(
                "codex_json.ok",
                metadata={
                    "label": label,
                    "attempt": attempt,
                    "duration_ms": result.duration_ms,
                },
            )
            return value  # type: ignore[return-value]
        except Exception as exc:
            last_error = exc
            if attempt == attempts:
                break
            obs.event(
                "codex_json.retry",
                metadata={
                    "label": label,
                    "attempt": attempt,
                    "next_attempt": attempt + 1,
                    "error": safe_exception(exc, obs.capture),
                },
            )
            prompt += (
                "\n\nYour previous response did not parse as the required JSON shape. "
                "Return STRICT JSON ONLY. Do not include markdown fences or prose."
            )
    raise RuntimeError(f"{label} failed: {last_error}") from last_error


def ensure_jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json", exclude_none=True)
    return value
