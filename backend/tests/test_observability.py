from __future__ import annotations

from app.core.config import Settings
from app.services.observability import (
    NoopProvider,
    build_observability,
    redact_text,
    safe_exception,
    text_payload,
)


def test_text_payload_metadata_does_not_include_raw_text() -> None:
    payload = text_payload("hello secret world", "metadata")

    assert payload is not None
    assert payload["chars"] == 18
    assert "sha256" in payload
    assert "text" not in payload
    assert "preview" not in payload


def test_text_payload_debug_redacts_secret_preview() -> None:
    payload = text_payload("Authorization: Bearer abc123\napi_key=secret-value", "debug")

    assert payload is not None
    assert "abc123" not in payload["preview"]
    assert "secret-value" not in payload["preview"]
    assert "[REDACTED]" in payload["preview"]


def test_redact_text_redacts_openai_style_key() -> None:
    fake_key = "sk-" + "1234567890abcdefghijklmnop"
    value = f"token {fake_key}"

    redacted = redact_text(value)

    assert fake_key not in redacted
    assert "[REDACTED_API_KEY]" in redacted


def test_safe_exception_omits_message_in_metadata_mode() -> None:
    fake_key = "sk-" + "1234567890abcdefghijklmnop"
    payload = safe_exception(RuntimeError(f"contains {fake_key}"), "metadata")

    assert payload == {"type": "RuntimeError"}


def test_langfuse_without_keys_falls_back_to_noop(tmp_path) -> None:
    provider = build_observability(
        Settings(
            R2L_DATA_DIR=tmp_path,
            R2L_OBSERVABILITY_PROVIDER="langfuse",
        )
    )

    assert isinstance(provider, NoopProvider)
