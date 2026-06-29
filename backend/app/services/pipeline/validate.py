from __future__ import annotations

from app.core.schemas import Course, ZhLesson, ZhOutline
from app.services.repo import RepoContext


class CourseValidationError(ValueError):
    pass


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

    return issues


def assert_valid_course(course: Course) -> None:
    issues = validate_course_schema(course)
    if issues:
        raise CourseValidationError("; ".join(issues))
