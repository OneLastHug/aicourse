from __future__ import annotations

import re
from collections import defaultdict

from app.core.config import Settings
from app.core.schemas import ZhLesson, ZhOutline, ZhOutlineLesson
from app.prompts.repair import lesson_repair_prompt
from app.services.observability import current_observability
from app.services.pipeline.call import CodexDriverLike, codex_json
from app.services.pipeline.repair_types import RepairIssue
from app.services.pipeline.run_types import ProgressCallback
from app.services.pipeline.validate import (
    validate_zh_course_alignment,
    validate_zh_course_schema,
)
from app.services.repo import RepoContext

MAX_REPAIR_ATTEMPTS = 2
MAX_REPAIR_LESSONS = 5

SNIPPET_RE = re.compile(
    r"^(?P<lesson>s\d+) step (?P<step>\d+) code snippet does not match real file contents: (?P<path>.+)$"
)
STEP_PATH_RE = re.compile(
    r"^(?P<lesson>s\d+) step (?P<step>\d+) code references missing path: (?P<path>.+)$"
)
LESSON_PATH_RE = re.compile(
    r"^(?P<lesson>s\d+) (?P<field>filesUsed|filesToRead) references missing path: (?P<path>.+)$"
)
LESSON_DOT_RE = re.compile(r"^(?P<lesson>s\d+)\.")
LESSON_WORD_RE = re.compile(r"\b(?:lesson|failed lesson) (?P<lesson>s\d+)\b")
LESSON_ID_RE = re.compile(r"\b(?P<lesson>s\d+)\b")


async def repair_zh_validation_round(
    *,
    round_no: int,
    ctx: RepoContext,
    outline: ZhOutline,
    lessons: dict[str, ZhLesson],
    issues: list[str],
    driver: CodexDriverLike,
    settings: Settings,
    on_progress: ProgressCallback,
) -> tuple[dict[str, ZhLesson], list[str]]:
    obs = current_observability()
    repairable = _repairable_issues(issues, round_no)
    if not repairable:
        obs.event(
            "repair.skipped",
            metadata={"round": round_no, "reason": "no_repairable_issues", "issue_count": len(issues)},
        )
        return lessons, issues

    lesson_ids = sorted({issue.lessonId for issue in repairable if issue.lessonId})
    if len(lesson_ids) > MAX_REPAIR_LESSONS:
        obs.event(
            "repair.skipped",
            metadata={
                "round": round_no,
                "reason": "too_many_lessons",
                "lesson_count": len(lesson_ids),
                "limit": MAX_REPAIR_LESSONS,
            },
        )
        await on_progress(
            {
                "type": "log",
                "level": "warn",
                "message": (
                    f"repair{round_no} skipped: {len(lesson_ids)} lessons need repair, "
                    f"above limit {MAX_REPAIR_LESSONS}"
                ),
            }
        )
        return lessons, issues

    current = dict(lessons)
    remaining = issues
    for attempt in range(1, MAX_REPAIR_ATTEMPTS + 1):
        grouped = _group_issues_for_existing_lessons(repairable, current)
        if not grouped:
            obs.event("repair.done", metadata={"round": round_no, "attempt": attempt, "reason": "no_grouped_issues"})
            return current, remaining

        attempt_ids = sorted(grouped)
        with obs.span(
            f"repair{round_no}.attempt",
            metadata={
                "round": round_no,
                "attempt": attempt,
                "lesson_ids": attempt_ids,
                "issue_count": sum(len(items) for items in grouped.values()),
            },
        ):
            await on_progress(
                {
                    "type": "repair",
                    "round": round_no,
                    "attempt": attempt,
                    "lessonIds": attempt_ids,
                    "issueCount": sum(len(items) for items in grouped.values()),
                }
            )
            await on_progress(
                {
                    "type": "log",
                    "level": "warn",
                    "message": f"repair{round_no} attempt {attempt}: " + ", ".join(attempt_ids),
                }
            )

            for lesson_id in attempt_ids:
                outline_lesson = _find_outline_lesson(outline, lesson_id)
                if outline_lesson is None:
                    continue
                with obs.span(
                    "repair.lesson",
                    metadata={"round": round_no, "attempt": attempt, "lesson_id": lesson_id},
                ):
                    repaired = await codex_json(
                        driver=driver,
                        label=f"repair{round_no}:{lesson_id}",
                        prompt=lesson_repair_prompt(
                            ctx,
                            outline,
                            outline_lesson,
                            current[lesson_id],
                            grouped[lesson_id],
                            round_no=round_no,
                        ),
                        cwd=ctx.localPath,
                        model=ZhLesson,
                        settings=settings,
                    )
                    repaired.id = lesson_id
                    current[lesson_id] = repaired
                    _sync_outline_files_to_repaired_lesson(outline, lesson_id, repaired, ctx)
                    await on_progress(
                        {
                            "type": "lessonDraft",
                            "id": lesson_id,
                            "body": repaired.model_dump(mode="json", exclude_none=True),
                        }
                    )

            local_issues = _local_issues_for_lessons(_validate_round(round_no, outline, current, ctx), attempt_ids)
            obs.event(
                "repair.local_validation",
                metadata={
                    "round": round_no,
                    "attempt": attempt,
                    "passed": not local_issues,
                    "issue_count": len(local_issues),
                    "lesson_ids": attempt_ids,
                },
            )
            if local_issues:
                remaining = _validate_round(round_no, outline, current, ctx)
                obs.event(
                    "repair.global_validation",
                    metadata={
                        "round": round_no,
                        "attempt": attempt,
                        "passed": not remaining,
                        "issue_count": len(remaining),
                    },
                )
                repairable = _repairable_issues(local_issues, round_no)
                if not repairable:
                    return current, remaining
                continue

            remaining = _validate_round(round_no, outline, current, ctx)
            obs.event(
                "repair.global_validation",
                metadata={
                    "round": round_no,
                    "attempt": attempt,
                    "passed": not remaining,
                    "issue_count": len(remaining),
                },
            )
            if not remaining:
                obs.event("repair.done", metadata={"round": round_no, "attempt": attempt, "passed": True})
                return current, []

            repairable = _repairable_issues(remaining, round_no)
            if not repairable:
                return current, remaining

    remaining = _validate_round(round_no, outline, current, ctx)
    obs.event(
        "repair.done",
        metadata={"round": round_no, "attempts": MAX_REPAIR_ATTEMPTS, "passed": not remaining, "issue_count": len(remaining)},
    )
    return current, remaining


def _validate_round(
    round_no: int,
    outline: ZhOutline,
    lessons: dict[str, ZhLesson],
    ctx: RepoContext,
) -> list[str]:
    if round_no == 1:
        return validate_zh_course_schema(outline, lessons)
    return validate_zh_course_alignment(outline, lessons, ctx)


def _repairable_issues(issues: list[str], round_no: int) -> list[RepairIssue]:
    parsed = [_parse_issue(issue, round_no) for issue in issues]
    return [issue for issue in parsed if issue is not None and issue.lessonId is not None]


def _parse_issue(message: str, round_no: int) -> RepairIssue | None:
    for pattern, kind in (
        (SNIPPET_RE, "snippet_mismatch"),
        (STEP_PATH_RE, "code_missing_path"),
        (LESSON_PATH_RE, "lesson_missing_path"),
    ):
        match = pattern.search(message)
        if match:
            groups = match.groupdict()
            return RepairIssue(
                round=round_no,  # type: ignore[arg-type]
                kind=kind,
                message=message,
                lessonId=groups.get("lesson"),
                path=groups.get("path"),
                stepIndex=int(groups["step"]) if groups.get("step") else None,
                field=groups.get("field"),
            )

    lesson_id = _lesson_id_from_message(message)
    if lesson_id is None:
        return None

    kind = "lesson_quality"
    if "mermaid" in message.lower():
        kind = "bad_mermaid"
    elif "missing path" in message or "references missing path" in message:
        kind = "missing_path"
    elif "title" in message:
        kind = "bad_title"
    elif "simulation" in message or "practice" in message:
        kind = "bad_interaction"
    elif "missing lesson bodies" in message:
        kind = "missing_lesson_body"
    elif "failed lesson" in message:
        kind = "bad_lesson_status"

    return RepairIssue(
        round=round_no,  # type: ignore[arg-type]
        kind=kind,
        message=message,
        lessonId=lesson_id,
    )


def _lesson_id_from_message(message: str) -> str | None:
    for pattern in (LESSON_DOT_RE, LESSON_WORD_RE, LESSON_ID_RE):
        match = pattern.search(message)
        if match:
            return match.group("lesson")
    return None


def _group_issues_for_existing_lessons(
    issues: list[RepairIssue],
    lessons: dict[str, ZhLesson],
) -> dict[str, list[RepairIssue]]:
    grouped: dict[str, list[RepairIssue]] = defaultdict(list)
    for issue in issues:
        if issue.lessonId and issue.lessonId in lessons:
            grouped[issue.lessonId].append(issue)
    return dict(grouped)


def _local_issues_for_lessons(issues: list[str], lesson_ids: list[str]) -> list[str]:
    return [issue for issue in issues if any(_issue_targets_lesson(issue, lesson_id) for lesson_id in lesson_ids)]


def _issue_targets_lesson(issue: str, lesson_id: str) -> bool:
    return (
        issue.startswith(f"{lesson_id} ")
        or issue.startswith(f"{lesson_id}.")
        or f"lesson {lesson_id}" in issue
        or f"failed lesson {lesson_id}" in issue
    )


def _find_outline_lesson(outline: ZhOutline, lesson_id: str) -> ZhOutlineLesson | None:
    for lesson in outline.lessons:
        if lesson.id == lesson_id:
            return lesson
    for section in outline.sections:
        for lesson in section.lessons:
            if lesson.id == lesson_id:
                return lesson
    return None


def _sync_outline_files_to_repaired_lesson(
    outline: ZhOutline,
    lesson_id: str,
    lesson: ZhLesson,
    ctx: RepoContext,
) -> None:
    valid_tree = set(ctx.tree)
    existing = _find_outline_lesson(outline, lesson_id)
    existing_files = existing.filesToRead if existing is not None else []
    files = _dedupe(
        [
            file
            for file in [*existing_files, *lesson.filesUsed]
            if _repo_relative_path(file, ctx) in valid_tree
        ]
    )
    if not files:
        return
    for item in outline.lessons:
        if item.id == lesson_id:
            item.filesToRead = files
    for section in outline.sections:
        for item in section.lessons:
            if item.id == lesson_id:
                item.filesToRead = files


def _repo_relative_path(file: str | None, ctx: RepoContext) -> str:
    value = (file or "").strip()
    if not value:
        return ""
    base = ctx.localPath.rstrip("/") + "/"
    if value.startswith(base):
        return value[len(base) :]
    return value


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result
