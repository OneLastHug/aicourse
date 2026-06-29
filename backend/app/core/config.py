from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the Python backend.

    Environment variable names intentionally mirror the existing TypeScript
    server where possible, so deployment can move incrementally.
    """

    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    r2l_data_dir: Path = Field(default_factory=lambda: Path.cwd() / "data", alias="R2L_DATA_DIR")
    r2l_mock: bool = Field(default=False, alias="R2L_MOCK")
    r2l_codex_binary: str = Field(default="codex", alias="R2L_CODEX_BINARY")
    r2l_codex_model: str = Field(default="gpt-5.5", alias="R2L_CODEX_MODEL")
    r2l_codex_reasoning_effort: str = Field(
        default="xhigh",
        alias="R2L_CODEX_REASONING_EFFORT",
    )
    r2l_codex_concurrency: int = Field(default=5, alias="R2L_CODEX_CONCURRENCY")
    r2l_codex_timeout_ms: int = Field(default=300 * 60 * 1000, alias="R2L_CODEX_TIMEOUT_MS")

    @property
    def data_dir(self) -> Path:
        return self.r2l_data_dir

    @property
    def courses_dir(self) -> Path:
        return self.data_dir / "courses"

    @property
    def jobs_dir(self) -> Path:
        return self.data_dir / "jobs"

    @property
    def work_dir(self) -> Path:
        return self.data_dir / "repos"

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"


@lru_cache
def get_settings() -> Settings:
    # Pydantic parses bools such as "1"/"true"; the explicit env lookup makes
    # the common existing `R2L_MOCK=1` path obvious when debugging.
    if os.environ.get("R2L_MOCK") == "1":
        os.environ["R2L_MOCK"] = "true"
    return Settings()

