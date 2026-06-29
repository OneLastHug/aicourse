from __future__ import annotations

import asyncio
import os
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class CodexCall:
    label: str
    prompt: str
    cwd: Path
    output_file: Path | None = None


@dataclass(frozen=True)
class CodexResult:
    text: str
    duration_ms: int


class CliCodexDriver:
    kind = "cli"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def run(self, call: CodexCall) -> CodexResult:
        started = time.monotonic()
        temp_dir: tempfile.TemporaryDirectory[str] | None = None
        if call.output_file is None:
            temp_dir = tempfile.TemporaryDirectory(prefix="repo2learn-")
            output_file = Path(temp_dir.name) / "last.txt"
        else:
            output_file = call.output_file

        args = [
            self.settings.r2l_codex_binary,
            "exec",
            "--model",
            self.settings.r2l_codex_model,
            "-c",
            f"model_reasoning_effort={self.settings.r2l_codex_reasoning_effort}",
            "-C",
            str(call.cwd),
            "--output-last-message",
            str(output_file),
        ]
        env = generation_codex_env(self.settings)

        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=str(call.cwd),
            env=env,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(call.prompt.encode("utf-8")),
                timeout=self.settings.r2l_codex_timeout_ms / 1000,
            )
        except TimeoutError as exc:
            proc.kill()
            await proc.wait()
            raise TimeoutError(
                f"codex timed out after {self.settings.r2l_codex_timeout_ms}ms"
            ) from exc

        if proc.returncode != 0:
            message = stderr.decode("utf-8", errors="replace")[-800:]
            raise RuntimeError(f"codex exited {proc.returncode}: {message}")

        text = stdout.decode("utf-8", errors="replace")
        try:
            final = output_file.read_text(encoding="utf-8").strip()
        except OSError:
            final = text.strip()
        finally:
            if temp_dir is not None:
                temp_dir.cleanup()

        return CodexResult(
            text=final or text.strip(),
            duration_ms=int((time.monotonic() - started) * 1000),
        )


def generation_codex_env(settings: Settings) -> dict[str, str]:
    """Build the tutorial-generation Codex environment without host Codex state."""

    codex_home = settings.codex_home
    codex_home.mkdir(parents=True, exist_ok=True)

    env: dict[str, str] = {}
    for key in (
        "PATH",
        "LANG",
        "LC_ALL",
        "LC_CTYPE",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "no_proxy",
    ):
        value = os.environ.get(key)
        if value:
            env[key] = value

    env["HOME"] = str(codex_home)
    env["CODEX_HOME"] = str(codex_home)
    return env
