from __future__ import annotations

import json
import re
from typing import Any, TypeVar

from pydantic import BaseModel, TypeAdapter

T = TypeVar("T")


class JsonExtractionError(ValueError):
    def __init__(self, message: str, raw: str) -> None:
        super().__init__(message)
        self.raw = raw


def extract_json(text: str) -> Any:
    cleaned = _strip_code_fences(text)
    start = _find_first_json_start(cleaned)
    if start < 0:
        raise JsonExtractionError("no JSON value found", text)
    end = _find_matching_end(cleaned, start)
    if end < 0:
        raise JsonExtractionError("unterminated JSON value", text)

    value = cleaned[start : end + 1]
    try:
        return json.loads(value)
    except json.JSONDecodeError as strict_error:
        try:
            return json.loads(_relaxed_json(value))
        except json.JSONDecodeError:
            raise JsonExtractionError(f"JSON.parse failed: {strict_error}", value) from strict_error


def parse_model(model: type[T], text: str) -> T:
    value = extract_json(text)
    if isinstance(model, type) and issubclass(model, BaseModel):
        return model.model_validate(value)  # type: ignore[return-value]
    return TypeAdapter(model).validate_python(value)


def _strip_code_fences(text: str) -> str:
    fences = re.findall(r"```(\w+)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if not fences:
        return text
    for lang, body in fences:
        if (lang or "").lower() == "json":
            return body
    for _lang, body in fences:
        if "{" in body or "[" in body:
            return body
    return fences[0][1]


def _find_first_json_start(text: str) -> int:
    starts = [idx for idx in (text.find("{"), text.find("[")) if idx >= 0]
    return min(starts) if starts else -1


def _find_matching_end(text: str, start: int) -> int:
    open_char = text[start]
    close_char = "}" if open_char == "{" else "]"
    depth = 0
    quote = ""
    escape = False
    for idx in range(start, len(text)):
        char = text[idx]
        if quote:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                quote = ""
            continue
        if char in {'"', "'"}:
            quote = char
        elif char == open_char:
            depth += 1
        elif char == close_char:
            depth -= 1
            if depth == 0:
                return idx
    return -1


def _relaxed_json(text: str) -> str:
    out: list[str] = []
    i = 0
    n = len(text)

    def last_significant() -> str:
        for char in reversed(out):
            if char not in {" ", "\n", "\r", "\t"}:
                return char
        return ""

    while i < n:
        char = text[i]
        if char == '"':
            out.append(char)
            i += 1
            while i < n:
                current = text[i]
                if current == "\\":
                    out.append(current)
                    if i + 1 < n:
                        out.append(text[i + 1])
                    i += 2
                    continue
                out.append(current)
                i += 1
                if current == '"':
                    break
            continue

        if char == "'":
            i += 1
            value = ""
            while i < n:
                current = text[i]
                if current == "\\":
                    nxt = text[i + 1] if i + 1 < n else ""
                    value += "'" if nxt == "'" else current + nxt
                    i += 2
                    continue
                if current == "'":
                    i += 1
                    break
                value += current
                i += 1
            out.append(json.dumps(value))
            continue

        if char == "/" and i + 1 < n and text[i + 1] == "/":
            i += 2
            while i < n and text[i] != "\n":
                i += 1
            continue
        if char == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue

        if char == ",":
            j = i + 1
            while j < n and text[j].isspace():
                j += 1
            if j < n and text[j] in {"}", "]"}:
                i += 1
                continue
            out.append(char)
            i += 1
            continue

        if re.match(r"[A-Za-z_$]", char):
            prev = last_significant()
            if prev in {"{", ","}:
                j = i
                ident = ""
                while j < n and re.match(r"[\w$]", text[j]):
                    ident += text[j]
                    j += 1
                k = j
                while k < n and text[k].isspace():
                    k += 1
                if k < n and text[k] == ":":
                    out.append(json.dumps(ident))
                    i = j
                    continue
            out.append(char)
            i += 1
            continue

        out.append(char)
        i += 1

    return "".join(out)

