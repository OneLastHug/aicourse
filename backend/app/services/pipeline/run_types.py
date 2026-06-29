from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

ProgressCallback = Callable[[dict[str, Any]], Awaitable[None]]

