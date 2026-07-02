from __future__ import annotations

import re
from pathlib import Path

from app.core.schemas import Bi, Course, ZhLesson, ZhOutline
from app.services.repo import RepoContext


class CourseValidationError(ValueError):
    pass


MERMAID_START_RE = re.compile(
    r"^\s*(flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|classDiagram(?:-v2)?|erDiagram|gantt|gitGraph|journey|pie|mindmap|timeline|stateDiagram-v2)\b",
    re.IGNORECASE,
)
UNSAFE_FLOW_LABEL_RE = re.compile(r"[()[\]{}<>|/@*#:]")
PLACEHOLDER_RE = re.compile(
    r"(TODO|TBD|FIXME|待补充|这里写|示例文本|占位|lorem ipsum|<\s*(?:TODO|TBD|FIXME|placeholder|待补充)\s*>)",
    re.IGNORECASE,
)
CHINESE_RE = re.compile(r"[\u4e00-\u9fff]")


def validate_course_schema(course: Course) -> list[str]:
    issues: list[str] = []
    outline_ids = [lesson.id for lesson in course.outline.lessons]
    if len(outline_ids) != len(set(outline_ids)):
        issues.append("duplicate outline lesson ids")

    missing = [lesson_id for lesson_id in outline_ids if lesson_id not in course.lessons]
    if missing:
        issues.append("missing lesson bodies: " + ", ".join(missing))

    extra = [lesson_id for lesson_id in course.lessons if lesson_id not in set(outline_ids)]
    if extra:
        issues.append("lesson bodies without outline entries: " + ", ".join(extra))

    for section in course.outline.sections:
        for lesson in section.lessons:
            if lesson.id not in outline_ids:
                issues.append(f"section {section.id} references non-flattened lesson {lesson.id}")

    for lesson_id, lesson in course.lessons.items():
        if lesson.id != lesson_id:
            issues.append(f"lesson key/id mismatch: {lesson_id} != {lesson.id}")
        if lesson.status != "ok" and not lesson.error:
            issues.append(f"failed lesson {lesson_id} is missing error")

    issues.extend(validate_course_title_language(course))
    issues.extend(validate_course_mermaid(course))
    return issues


def validate_course_alignment(course: Course, ctx: RepoContext) -> list[str]:
    """Best-effort repository alignment checks.

    These are warnings, not hard failures. They catch common hallucinations in
    generated course JSON while preserving the generated course for review, like
    the original TypeScript validation stages.
    """

    issues: list[str] = []
    tree = set(ctx.tree)

    for lesson in course.outline.lessons:
        for file in lesson.keyFiles:
            if file and file not in tree:
                issues.append(f"{lesson.id} keyFiles references missing path: {file}")

    for lesson_id, lesson in course.lessons.items():
        for idx, step in enumerate(lesson.howItWorks):
            code = step.code
            if code is None or code.isSpine:
                continue
            if code.file and code.file not in tree:
                issues.append(f"{lesson_id} step {idx + 1} code references missing path: {code.file}")
            elif code.file and code.snippet:
                issues.extend(
                    _validate_snippet_matches_file(
                        ctx=ctx,
                        file=code.file,
                        snippet=code.snippet,
                        label=f"{lesson_id} step {idx + 1}",
                    )
                )

    return issues


def validate_zh_course_schema(outline: ZhOutline, lessons: dict[str, ZhLesson]) -> list[str]:
    issues: list[str] = []
    outline_ids = [lesson.id for lesson in outline.lessons]
    if len(outline_ids) != len(set(outline_ids)):
        issues.append("duplicate outline lesson ids")

    missing = [lesson_id for lesson_id in outline_ids if lesson_id not in lessons]
    if missing:
        issues.append("missing lesson bodies: " + ", ".join(missing))

    extra = [lesson_id for lesson_id in lessons if lesson_id not in set(outline_ids)]
    if extra:
        issues.append("lesson bodies without outline entries: " + ", ".join(extra))

    for section in outline.sections:
        for lesson in section.lessons:
            if lesson.id not in outline_ids:
                issues.append(f"section {section.id} references non-flattened lesson {lesson.id}")

    for lesson_id, lesson in lessons.items():
        if lesson.id != lesson_id:
            issues.append(f"lesson key/id mismatch: {lesson_id} != {lesson.id}")
        if lesson.status != "ok" and not lesson.error:
            issues.append(f"failed lesson {lesson_id} is missing error")
        if lesson.status == "ok" and not lesson.howItWorks:
            issues.append(f"lesson {lesson_id} has no howItWorks steps")
        if lesson.status == "ok" and not lesson.deepDive.strip():
            issues.append(f"lesson {lesson_id} has empty deepDive")

    issues.extend(validate_zh_course_mermaid(outline, lessons))
    issues.extend(validate_zh_course_quality(outline, lessons))
    return issues


def validate_zh_course_alignment(outline: ZhOutline, lessons: dict[str, ZhLesson], ctx: RepoContext) -> list[str]:
    issues: list[str] = []
    tree = set(ctx.tree)

    for lesson in outline.lessons:
        for file in lesson.filesToRead:
            if file and file not in tree:
                issues.append(f"{lesson.id} filesToRead references missing path: {file}")

    for lesson_id, lesson in lessons.items():
        for file in lesson.filesUsed:
            if file and file not in tree:
                issues.append(f"{lesson_id} filesUsed references missing path: {file}")
        for idx, step in enumerate(lesson.howItWorks):
            code = step.code
            if code is None or code.isSpine:
                continue
            if code.file and code.file not in tree:
                issues.append(f"{lesson_id} step {idx + 1} code references missing path: {code.file}")
            elif code.file and code.snippet:
                issues.extend(
                    _validate_snippet_matches_file(
                        ctx=ctx,
                        file=code.file,
                        snippet=code.snippet,
                        label=f"{lesson_id} step {idx + 1}",
                    )
                )

    return issues


def assert_valid_course(course: Course) -> None:
    issues = validate_course_schema(course)
    if issues:
        raise CourseValidationError("; ".join(issues))


def validate_zh_course_mermaid(outline: ZhOutline, lessons: dict[str, ZhLesson]) -> list[str]:
    issues: list[str] = []
    if outline.archDiagram is not None:
        issues.extend(validate_mermaid_text(outline.archDiagram.diagram, "outline.archDiagram"))
    for lesson_id, lesson in lessons.items():
        if lesson.diagram is not None:
            issues.extend(validate_mermaid_text(lesson.diagram.diagram, f"{lesson_id}.diagram"))
    return issues


def validate_course_mermaid(course: Course) -> list[str]:
    issues: list[str] = []
    if course.outline.archDiagram is not None:
        issues.extend(validate_mermaid_text(course.outline.archDiagram.diagram, "outline.archDiagram"))
    for lesson_id, lesson in course.lessons.items():
        if lesson.diagram is not None:
            issues.extend(validate_mermaid_text(lesson.diagram.diagram, f"{lesson_id}.diagram"))
    return issues


def validate_course_title_language(course: Course) -> list[str]:
    issues: list[str] = []
    issues.extend(_validate_bi_english_title(course.outline.course.title, "outline.course.title", max_chars=72))
    for section in course.outline.sections:
        issues.extend(_validate_bi_english_title(section.title, f"section {section.id} title", max_chars=48))
        for lesson in section.lessons:
            issues.extend(_validate_bi_english_title(lesson.title, f"{lesson.id}.title", max_chars=50))
    for lesson_id, lesson in course.lessons.items():
        for idx, step in enumerate(lesson.howItWorks, start=1):
            issues.extend(
                _validate_bi_english_title(
                    step.title,
                    f"{lesson_id}.howItWorks[{idx}].title",
                    max_chars=48,
                )
            )
    return issues


def validate_mermaid_text(diagram: str, label: str) -> list[str]:
    text = diagram.strip()
    issues: list[str] = []
    if not text:
        return [f"{label} mermaid diagram is empty"]
    if not MERMAID_START_RE.search(text):
        issues.append(f"{label} mermaid diagram must start with a supported Mermaid diagram type")

    first = text.splitlines()[0].strip().lower()
    if first.startswith(("flowchart", "graph")):
        issues.extend(_validate_flowchart_labels(text, label))
    return issues


def validate_zh_course_quality(outline: ZhOutline, lessons: dict[str, ZhLesson]) -> list[str]:
    issues: list[str] = []
    issues.extend(_validate_english_title(outline.course.title, "course.title", min_chars=4, max_chars=72))
    issues.extend(_validate_zh_text(outline.course.tagline, "course.tagline", min_chars=18, max_chars=120))
    if outline.course.thesis:
        issues.extend(_validate_zh_text(outline.course.thesis, "course.thesis", min_chars=12, max_chars=180))
    for section in outline.sections:
        issues.extend(_validate_english_title(section.title, f"section {section.id} title", min_chars=2, max_chars=48))
        issues.extend(_validate_zh_text(section.summary, f"section {section.id} summary", min_chars=18, max_chars=160))
        for lesson in section.lessons:
            issues.extend(_validate_outline_lesson_quality(lesson.id, lesson.title, lesson.theProblem, lesson.objective))

    for lesson_id, lesson in lessons.items():
        if lesson.status != "ok":
            continue
        issues.extend(_validate_zh_text(lesson.problem, f"{lesson_id}.problem", min_chars=20, max_chars=360))
        if lesson.solution:
            issues.extend(_validate_zh_text(lesson.solution, f"{lesson_id}.solution", min_chars=16, max_chars=320))
        if lesson.principle:
            issues.extend(_validate_zh_text(lesson.principle, f"{lesson_id}.principle", min_chars=8, max_chars=140))
        if lesson.teachingScope:
            issues.extend(_validate_zh_text(lesson.teachingScope, f"{lesson_id}.teachingScope", min_chars=16, max_chars=320))
        issues.extend(
            _validate_zh_text(
                lesson.deepDive,
                f"{lesson_id}.deepDive",
                min_chars=120,
                max_chars=3600,
                check_repeated=False,
            )
        )
        if lesson.deepSource:
            issues.extend(
                _validate_zh_text(
                    lesson.deepSource,
                    f"{lesson_id}.deepSource",
                    min_chars=60,
                    max_chars=3600,
                    check_repeated=False,
                )
            )
        for idx, step in enumerate(lesson.howItWorks, start=1):
            issues.extend(
                _validate_english_title(
                    step.title,
                    f"{lesson_id}.howItWorks[{idx}].title",
                    min_chars=2,
                    max_chars=48,
                )
            )
            issues.extend(_validate_zh_text(step.desc, f"{lesson_id}.howItWorks[{idx}].desc", min_chars=18, max_chars=420))
            if _looks_like_sentence_title(step.title):
                issues.append(f"{lesson_id}.howItWorks[{idx}].title should be a compact label, not a full sentence")
        if lesson.tryIt is not None:
            if not lesson.tryIt.commands:
                issues.append(f"{lesson_id}.tryIt.commands must not be empty")
            if not lesson.tryIt.observe:
                issues.append(f"{lesson_id}.tryIt.observe must not be empty")
        if not lesson.filesUsed:
            issues.append(f"{lesson_id}.filesUsed must list the real repository files used by the lesson")
    return issues


def _validate_outline_lesson_quality(
    lesson_id: str,
    title: str,
    problem: str,
    objective: str,
) -> list[str]:
    issues: list[str] = []
    issues.extend(_validate_english_title(title, f"{lesson_id}.title", min_chars=2, max_chars=50))
    issues.extend(_validate_zh_text(problem, f"{lesson_id}.theProblem", min_chars=18, max_chars=180))
    issues.extend(_validate_zh_text(objective, f"{lesson_id}.objective", min_chars=16, max_chars=220))
    if _looks_like_sentence_title(title):
        issues.append(f"{lesson_id}.title should be short but understandable, not a full sentence")
    return issues


def _validate_english_title(text: str, label: str, *, min_chars: int, max_chars: int) -> list[str]:
    value = (text or "").strip()
    issues: list[str] = []
    if len(value) < min_chars:
        issues.append(f"{label} is too terse for a readable English title")
    if len(value) > max_chars:
        issues.append(f"{label} is too long; keep the English title compact")
    if PLACEHOLDER_RE.search(value):
        issues.append(f"{label} contains placeholder or unfinished text")
    if CHINESE_RE.search(value):
        issues.append(f"{label} must use English, even in the Chinese course version")
    if value and not re.search(r"[A-Za-z]", value):
        issues.append(f"{label} should contain English words or technical terms")
    if _has_repeated_fragment(value):
        issues.append(f"{label} repeats the same wording too much")
    if _has_unbalanced_cjk_punctuation(value):
        issues.append(f"{label} has unbalanced Chinese punctuation or brackets")
    return issues


def _validate_bi_english_title(title: Bi, label: str, *, max_chars: int) -> list[str]:
    issues: list[str] = []
    issues.extend(_validate_english_title(title.zh, f"{label}.zh", min_chars=2, max_chars=max_chars))
    issues.extend(_validate_english_title(title.en, f"{label}.en", min_chars=2, max_chars=max_chars))
    return issues


def _validate_zh_text(
    text: str,
    label: str,
    *,
    min_chars: int,
    max_chars: int,
    check_repeated: bool = True,
) -> list[str]:
    value = (text or "").strip()
    issues: list[str] = []
    if len(value) < min_chars:
        issues.append(f"{label} is too terse for a readable Chinese technical explanation")
    if len(value) > max_chars:
        issues.append(f"{label} is too long; keep it concise like a technical blog")
    if PLACEHOLDER_RE.search(value):
        issues.append(f"{label} contains placeholder or unfinished text")
    if not CHINESE_RE.search(value):
        issues.append(f"{label} should contain Chinese user-facing prose")
    if check_repeated and _has_repeated_fragment(value):
        issues.append(f"{label} repeats the same wording too much")
    if _has_unbalanced_cjk_punctuation(value):
        issues.append(f"{label} has unbalanced Chinese punctuation or brackets")
    return issues


def _validate_flowchart_labels(diagram: str, label: str) -> list[str]:
    issues: list[str] = []
    for line_no, raw_line in enumerate(diagram.splitlines(), start=1):
        line = raw_line.split("%%", 1)[0]
        issues.extend(_validate_flowchart_edge_labels(line, label, line_no))
        idx = 0
        while idx < len(line):
            if not _is_identifier_start(line[idx]) or (idx > 0 and _is_identifier_part(line[idx - 1])):
                idx += 1
                continue

            ident_start = idx
            idx += 1
            while idx < len(line) and _is_identifier_part(line[idx]):
                idx += 1
            ident = line[ident_start:idx]
            while idx < len(line) and line[idx].isspace():
                idx += 1
            if idx >= len(line):
                continue

            opener = line[idx]
            if opener == "[":
                content, end = _read_balanced(line, idx, "[", "]")
                if content is None:
                    issues.append(f"{label} line {line_no} has an unclosed Mermaid node label for {ident}")
                    break
                stripped = content.strip()
                if stripped and not _is_quoted_label(stripped) and not _is_shape_wrapped_label(stripped):
                    if UNSAFE_FLOW_LABEL_RE.search(stripped):
                        issues.append(
                            f'{label} line {line_no} node {ident} label contains Mermaid-sensitive characters; quote it as {ident}["{_escape_mermaid_label(stripped)}"]'
                        )
                idx = end + 1
                continue
            if opener == "{":
                content, end = _read_balanced(line, idx, "{", "}")
                if content is None:
                    issues.append(f"{label} line {line_no} has an unclosed Mermaid decision label for {ident}")
                    break
                stripped = content.strip()
                if stripped and not _is_quoted_label(stripped) and UNSAFE_FLOW_LABEL_RE.search(stripped):
                    issues.append(
                        f'{label} line {line_no} decision {ident} label contains Mermaid-sensitive characters; quote or simplify the label'
                    )
                idx = end + 1
                continue
            if opener == "(":
                close = ")" if idx + 1 >= len(line) or line[idx + 1] != "(" else "))"
                end = line.find(close, idx + len(close))
                idx = len(line) if end < 0 else end + len(close)
                continue
        if "-->" not in line and "---" not in line and line.strip() and not line.strip().lower().startswith(("flowchart", "graph", "subgraph", "end")):
            issues.append(f"{label} line {line_no} does not look like a connected flowchart statement")
    return issues


def _validate_flowchart_edge_labels(line: str, label: str, line_no: int) -> list[str]:
    issues: list[str] = []
    if "|" not in line:
        return issues

    quote: str | None = None
    escaped = False
    in_pipe_label = False
    pipe_start = 0
    for idx, ch in enumerate(line):
        if escaped:
            escaped = False
            continue
        if quote:
            if ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            continue
        if ch in {'"', "'"}:
            quote = ch
            continue
        if ch != "|":
            continue

        if in_pipe_label:
            content = line[pipe_start:idx].strip()
            if content and not _is_quoted_label(content) and UNSAFE_FLOW_LABEL_RE.search(content):
                issues.append(
                    f'{label} line {line_no} edge label contains Mermaid-sensitive characters; quote it as |"{_escape_mermaid_label(content)}"|'
                )
            in_pipe_label = False
        else:
            in_pipe_label = True
            pipe_start = idx + 1
    return issues


def _read_balanced(line: str, start: int, opener: str, closer: str) -> tuple[str | None, int]:
    quote: str | None = None
    escaped = False
    pos = start + 1
    while pos < len(line):
        ch = line[pos]
        if escaped:
            escaped = False
        elif ch == "\\":
            escaped = True
        elif quote:
            if ch == quote:
                quote = None
        elif ch in {'"', "'"}:
            quote = ch
        elif ch == closer:
            return line[start + 1 : pos], pos
        pos += 1
    return None, len(line)


def _is_identifier_start(ch: str) -> bool:
    return ch.isascii() and (ch.isalpha() or ch == "_")


def _is_identifier_part(ch: str) -> bool:
    return ch.isascii() and (ch.isalnum() or ch in {"_", "-"})


def _is_quoted_label(value: str) -> bool:
    return len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}


def _is_shape_wrapped_label(value: str) -> bool:
    return len(value) >= 2 and value[0] in {"(", "[", "{", "/"} and value[-1] in {")",
        "]",
        "}",
        "/",
    }


def _escape_mermaid_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _looks_like_sentence_title(value: str) -> bool:
    stripped = value.strip()
    return len(stripped) > 18 and bool(re.search(r"[，。；：！？,.!?;:]$", stripped))


def _has_repeated_fragment(value: str) -> bool:
    compact = re.sub(r"\s+", "", value)
    if len(compact) < 24:
        return False
    for size in range(6, 13):
        seen: dict[str, int] = {}
        for idx in range(0, len(compact) - size + 1, size):
            part = compact[idx : idx + size]
            seen[part] = seen.get(part, 0) + 1
            if seen[part] >= 3:
                return True
    return False


def _has_unbalanced_cjk_punctuation(value: str) -> bool:
    pairs = {"（": "）", "“": "”", "《": "》", "【": "】", "「": "」"}
    for left, right in pairs.items():
        if value.count(left) != value.count(right):
            return True
    return False


def _validate_snippet_matches_file(
    *,
    ctx: RepoContext,
    file: str,
    snippet: str,
    label: str,
) -> list[str]:
    if len(snippet.strip()) < 20 or "..." in snippet:
        return []
    path = Path(ctx.localPath) / file
    try:
        source = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return [f"{label} code snippet file could not be read: {file}"]

    if _normalize_code(snippet) in _normalize_code(source):
        return []

    snippet_lines = [line.strip() for line in snippet.splitlines() if line.strip()]
    if snippet_lines:
        matched = sum(1 for line in snippet_lines if line and line in source)
        if matched / len(snippet_lines) >= 0.75:
            return []
    return [f"{label} code snippet does not match real file contents: {file}"]


def _normalize_code(value: str) -> str:
    return re.sub(r"\s+", "", value)
