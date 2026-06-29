from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, TypeVar

from app.core.config import Settings, get_settings

T = TypeVar("T")


class Cache:
    def __init__(self, directory: Path, enabled: bool = True) -> None:
        self.directory = directory
        self.enabled = enabled

    @classmethod
    def from_settings(cls, settings: Settings | None = None, enabled: bool = True) -> Cache:
        cfg = settings or get_settings()
        return cls(cfg.cache_dir, enabled)

    def key(self, parts: dict[str, Any]) -> str:
        stable = json.dumps(parts, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(stable.encode("utf-8")).hexdigest()[:24]

    def get(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        try:
            return json.loads((self.directory / f"{key}.json").read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return None

    def set(self, key: str, value: Any) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        (self.directory / f"{key}.json").write_text(
            json.dumps(value, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

