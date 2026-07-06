from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class RepairIssue(BaseModel):
    round: Literal[1, 2]
    kind: str
    message: str
    lessonId: str | None = None
    path: str | None = None
    stepIndex: int | None = None
    field: str | None = None
