from __future__ import annotations

import json
from typing import Any

from pydantic import TypeAdapter

from app.core.schemas import ProgressEvent

ProgressEventAdapter = TypeAdapter(ProgressEvent)


def validate_progress_event(event: dict[str, Any]) -> dict[str, Any]:
    validated = ProgressEventAdapter.validate_python(event)
    return validated.model_dump(mode="json", exclude_none=True)


def is_terminal_event(event: dict[str, Any]) -> bool:
    return (event.get("type") == "stage" and event.get("stage") == "done") or event.get(
        "type"
    ) == "error"


def json_dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def sse_data(event: dict[str, Any]) -> str:
    return f"data: {json_dumps(validate_progress_event(event))}\n\n"

