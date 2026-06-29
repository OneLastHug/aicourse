from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.events import is_terminal_event, sse_data, validate_progress_event


def test_validate_progress_event_strips_none_and_keeps_contract() -> None:
    event = validate_progress_event({"type": "stage", "stage": "done", "label": None})
    assert event == {"type": "stage", "stage": "done"}


def test_validate_progress_event_rejects_unknown_stage() -> None:
    with pytest.raises(ValidationError):
        validate_progress_event({"type": "stage", "stage": "not-a-stage"})


def test_sse_data_uses_compact_json() -> None:
    assert (
        sse_data({"type": "lesson", "id": "s01", "status": "ok"})
        == 'data: {"type":"lesson","id":"s01","status":"ok"}\n\n'
    )


def test_terminal_event_detection() -> None:
    assert is_terminal_event({"type": "stage", "stage": "done"})
    assert is_terminal_event({"type": "error", "message": "failed"})
    assert not is_terminal_event({"type": "stage", "stage": "lessons"})

