from __future__ import annotations

import contextvars
import hashlib
import logging
import os
import re
import subprocess
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import Settings

logger = logging.getLogger(__name__)

_MAX_PREVIEW_CHARS = 2000
_MAX_METADATA_STRING_CHARS = 500

_SECRET_PATTERNS = [
    re.compile(r"(?i)(authorization\s*:\s*bearer\s+)[^\s\"']+"),
    re.compile(r"(?i)((?:api[_-]?key|secret|token|password)\s*[:=]\s*[\"']?)[^\"'\s,;}]+"),
    re.compile(r"\b(sk-[A-Za-z0-9_-]{16,})\b"),
]


def hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def short_hash(value: str, length: int = 16) -> str:
    return hash_text(value)[:length]


def redact_text(value: str) -> str:
    redacted = value
    for pattern in _SECRET_PATTERNS:
        redacted = pattern.sub(_redact_match, redacted)
    return redacted


def _redact_match(match: re.Match[str]) -> str:
    prefix = match.group(1)
    if prefix.startswith("sk-"):
        return "[REDACTED_API_KEY]"
    return f"{prefix}[REDACTED]"


def text_payload(value: str | None, capture: str) -> dict[str, Any] | None:
    if value is None:
        return None
    payload: dict[str, Any] = {
        "chars": len(value),
        "sha256": hash_text(value),
    }
    mode = normalize_capture(capture)
    if mode == "debug":
        payload["preview"] = redact_text(value[:_MAX_PREVIEW_CHARS])
    elif mode == "full":
        payload["text"] = redact_text(value)
    return payload


def safe_exception(exc: BaseException, capture: str) -> dict[str, Any]:
    payload: dict[str, Any] = {"type": type(exc).__name__}
    if normalize_capture(capture) in {"debug", "full"}:
        payload["message"] = redact_text(str(exc))[:_MAX_METADATA_STRING_CHARS]
    return payload


def normalize_capture(value: str | None) -> str:
    mode = (value or "metadata").strip().lower()
    if mode not in {"metadata", "debug", "full"}:
        return "metadata"
    return mode


def normalize_provider(value: str | None) -> str:
    provider = (value or "none").strip().lower()
    if provider not in {"none", "langfuse", "otlp"}:
        return "none"
    return provider


def safe_metadata(value: Any, capture: str) -> Any:
    mode = normalize_capture(capture)
    if value is None or isinstance(value, bool | int | float):
        return value
    if isinstance(value, str):
        text = redact_text(value)
        if mode != "full" and len(text) > _MAX_METADATA_STRING_CHARS:
            return text[:_MAX_METADATA_STRING_CHARS] + "...[truncated]"
        return text
    if isinstance(value, dict):
        return {str(k): safe_metadata(v, capture) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [safe_metadata(item, capture) for item in value]
    return safe_metadata(str(value), capture)


def git_release() -> str | None:
    env_release = os.environ.get("AICOURSE_RELEASE") or os.environ.get("GIT_SHA")
    if env_release:
        return env_release[:40]
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short=12", "HEAD"],
            cwd=os.getcwd(),
            text=True,
            capture_output=True,
            timeout=2,
            check=False,
        )
    except Exception:
        return None
    if result.returncode == 0:
        return result.stdout.strip() or None
    return None


class Observation(Protocol):
    def update(self, **kwargs: Any) -> None: ...

    def event(self, name: str, metadata: dict[str, Any] | None = None, **kwargs: Any) -> None: ...

    def score(self, name: str, value: float | str, metadata: dict[str, Any] | None = None) -> None: ...


class ObservabilityProvider(Protocol):
    capture: str

    @contextmanager
    def span(
        self,
        name: str,
        *,
        metadata: dict[str, Any] | None = None,
        input: Any | None = None,
    ) -> Iterator[Observation]: ...

    @contextmanager
    def generation(
        self,
        name: str,
        *,
        model: str | None = None,
        metadata: dict[str, Any] | None = None,
        input: Any | None = None,
        model_parameters: dict[str, Any] | None = None,
    ) -> Iterator[Observation]: ...

    def event(self, name: str, metadata: dict[str, Any] | None = None, **kwargs: Any) -> None: ...

    def score(self, name: str, value: float | str, metadata: dict[str, Any] | None = None) -> None: ...

    def flush(self) -> None: ...

    def shutdown(self) -> None: ...


@dataclass
class NoopObservation:
    def update(self, **kwargs: Any) -> None:
        return None

    def event(self, name: str, metadata: dict[str, Any] | None = None, **kwargs: Any) -> None:
        return None

    def score(self, name: str, value: float | str, metadata: dict[str, Any] | None = None) -> None:
        return None


class NoopProvider:
    capture = "metadata"

    @contextmanager
    def span(
        self,
        name: str,
        *,
        metadata: dict[str, Any] | None = None,
        input: Any | None = None,
    ) -> Iterator[NoopObservation]:
        yield NoopObservation()

    @contextmanager
    def generation(
        self,
        name: str,
        *,
        model: str | None = None,
        metadata: dict[str, Any] | None = None,
        input: Any | None = None,
        model_parameters: dict[str, Any] | None = None,
    ) -> Iterator[NoopObservation]:
        yield NoopObservation()

    def event(self, name: str, metadata: dict[str, Any] | None = None, **kwargs: Any) -> None:
        return None

    def score(self, name: str, value: float | str, metadata: dict[str, Any] | None = None) -> None:
        return None

    def flush(self) -> None:
        return None

    def shutdown(self) -> None:
        return None


class LangfuseObservation:
    def __init__(self, raw: Any, capture: str) -> None:
        self.raw = raw
        self.capture = capture

    def update(self, **kwargs: Any) -> None:
        try:
            self.raw.update(**_sanitize_observation_kwargs(kwargs, self.capture))
        except Exception:
            logger.debug("failed to update Langfuse observation", exc_info=True)

    def event(self, name: str, metadata: dict[str, Any] | None = None, **kwargs: Any) -> None:
        try:
            self.raw.create_event(
                name=name,
                metadata=safe_metadata(metadata or {}, self.capture),
                **_sanitize_observation_kwargs(kwargs, self.capture),
            )
        except Exception:
            logger.debug("failed to create Langfuse event", exc_info=True)

    def score(self, name: str, value: float | str, metadata: dict[str, Any] | None = None) -> None:
        try:
            self.raw.score_trace(name=name, value=value, metadata=safe_metadata(metadata or {}, self.capture))
        except Exception:
            logger.debug("failed to create Langfuse score", exc_info=True)


class LangfuseProvider:
    def __init__(self, settings: Settings) -> None:
        from langfuse import Langfuse

        host = settings.langfuse_base_url or settings.langfuse_host
        self.capture = normalize_capture(settings.r2l_observability_capture)
        self.client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=host,
            environment=settings.r2l_observability_env,
            release=git_release(),
            sample_rate=settings.r2l_observability_sample_rate,
            timeout=max(1, settings.r2l_observability_flush_timeout_ms // 1000),
        )

    @contextmanager
    def span(
        self,
        name: str,
        *,
        metadata: dict[str, Any] | None = None,
        input: Any | None = None,
    ) -> Iterator[Observation]:
        with self._observation(name=name, as_type="span", metadata=metadata, input=input) as observation:
            yield observation

    @contextmanager
    def generation(
        self,
        name: str,
        *,
        model: str | None = None,
        metadata: dict[str, Any] | None = None,
        input: Any | None = None,
        model_parameters: dict[str, Any] | None = None,
    ) -> Iterator[Observation]:
        with self._observation(
            name=name,
            as_type="generation",
            metadata=metadata,
            input=input,
            model=model,
            model_parameters=model_parameters,
        ) as observation:
            yield observation

    @contextmanager
    def _observation(
        self,
        *,
        name: str,
        as_type: str,
        metadata: dict[str, Any] | None = None,
        input: Any | None = None,
        model: str | None = None,
        model_parameters: dict[str, Any] | None = None,
    ) -> Iterator[Observation]:
        try:
            manager = self.client.start_as_current_observation(
                name=name,
                as_type=as_type,
                metadata=safe_metadata(metadata or {}, self.capture),
                input=safe_metadata(input, self.capture),
                model=model,
                model_parameters=safe_metadata(model_parameters or {}, self.capture),
            )
            raw = manager.__enter__()
        except Exception:
            logger.warning("Langfuse observation start failed; continuing without tracing", exc_info=True)
            yield NoopObservation()
            return

        observation = LangfuseObservation(raw, self.capture)
        token = _current_observation.set(observation)
        try:
            yield observation
        except Exception as exc:
            observation.update(level="ERROR", status_message=safe_exception(exc, self.capture).get("message", type(exc).__name__))
            raise
        finally:
            _current_observation.reset(token)
            try:
                manager.__exit__(None, None, None)
            except Exception:
                logger.debug("failed to close Langfuse observation", exc_info=True)

    def event(self, name: str, metadata: dict[str, Any] | None = None, **kwargs: Any) -> None:
        current = _current_observation.get() or NoopObservation()
        current.event(name, metadata=metadata, **kwargs)

    def score(self, name: str, value: float | str, metadata: dict[str, Any] | None = None) -> None:
        current = _current_observation.get() or NoopObservation()
        current.score(name, value, metadata)

    def flush(self) -> None:
        try:
            self.client.flush()
        except Exception:
            logger.debug("Langfuse flush failed", exc_info=True)

    def shutdown(self) -> None:
        try:
            self.client.shutdown()
        except Exception:
            logger.debug("Langfuse shutdown failed", exc_info=True)


def _sanitize_observation_kwargs(kwargs: dict[str, Any], capture: str) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for key, value in kwargs.items():
        if value is None:
            continue
        sanitized[key] = safe_metadata(value, capture)
    return sanitized


_NOOP = NoopProvider()
_current_provider: contextvars.ContextVar[ObservabilityProvider] = contextvars.ContextVar(
    "aicourse_observability_provider",
    default=_NOOP,
)
_current_observation: contextvars.ContextVar[Observation | None] = contextvars.ContextVar(
    "aicourse_observability_observation",
    default=None,
)


def build_observability(settings: Settings) -> ObservabilityProvider:
    provider = normalize_provider(settings.r2l_observability_provider)
    if provider == "none":
        return _NOOP
    if provider == "otlp":
        logger.warning("R2L_OBSERVABILITY_PROVIDER=otlp is not implemented yet; using no-op")
        return _NOOP
    if provider == "langfuse":
        if not settings.langfuse_public_key or not settings.langfuse_secret_key:
            logger.warning("Langfuse provider selected but LANGFUSE_PUBLIC_KEY/SECRET_KEY are missing")
            return _NOOP
        try:
            return LangfuseProvider(settings)
        except Exception:
            logger.warning("Langfuse initialization failed; using no-op", exc_info=True)
            return _NOOP
    return _NOOP


@contextmanager
def observability_scope(provider: ObservabilityProvider) -> Iterator[None]:
    token = _current_provider.set(provider)
    try:
        yield
    finally:
        _current_provider.reset(token)


def current_observability() -> ObservabilityProvider:
    return _current_provider.get()
