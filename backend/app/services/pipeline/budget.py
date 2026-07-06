from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel

from app.services.repo import RepoContext


class LessonBudget(BaseModel):
    targetLessons: int
    minLessons: int
    maxLessons: int
    minSections: int
    maxSections: int
    rationale: str
    signals: list[str]


def estimate_lesson_budget(ctx: RepoContext, analysis: dict[str, Any]) -> LessonBudget:
    """Choose a bounded lesson budget from repository complexity signals."""

    score = 0
    signals: list[str] = []
    file_count = len(ctx.tree)
    entrypoint_count = _list_len(analysis.get("entrypoints"))
    flow_count = _list_len(analysis.get("coreFlows"))

    if ctx.loc > 500_000:
        score += 3
        signals.append("loc>500k")
    elif ctx.loc > 200_000:
        score += 2
        signals.append("loc>200k")
    elif ctx.loc > 50_000:
        score += 2
        signals.append("loc>50k")

    if file_count > 1_500:
        score += 2
        signals.append("files>1500")
    elif file_count > 500:
        score += 1
        signals.append("files>500")

    if entrypoint_count >= 8:
        score += 1
        signals.append("entrypoints>=8")
    elif entrypoint_count >= 4:
        score += 1
        signals.append("entrypoints>=4")

    if flow_count >= 8:
        score += 2
        signals.append("coreFlows>=8")
    elif flow_count >= 5:
        score += 1
        signals.append("coreFlows>=5")

    surface_score = _surface_complexity_score(ctx, analysis)
    if surface_score:
        score += surface_score
        signals.append(f"advanced-surfaces+{surface_score}")

    target = _clamp(5 + score, 3, 20)
    if ctx.loc < 5_000 and file_count < 100 and entrypoint_count <= 2 and flow_count <= 3:
        target = min(target, 3)
        signals.append("small-repo-cap")

    min_lessons = max(2, target - (1 if target <= 7 else 2))
    max_lessons = min(20, target + (1 if target <= 7 else 2))
    min_sections, max_sections = _section_range(target)
    if not signals:
        signals.append("baseline")

    return LessonBudget(
        targetLessons=target,
        minLessons=min_lessons,
        maxLessons=max_lessons,
        minSections=min_sections,
        maxSections=max_sections,
        rationale=(
            f"{ctx.loc} LOC, {file_count} files, {entrypoint_count} entrypoints, "
            f"{flow_count} core flows -> {target} lessons"
        ),
        signals=signals,
    )


def validate_outline_budget(lesson_count: int, section_count: int, budget: LessonBudget) -> list[str]:
    issues: list[str] = []
    if lesson_count < budget.minLessons or lesson_count > budget.maxLessons:
        issues.append(
            f"lesson count {lesson_count} is outside budget range "
            f"{budget.minLessons}-{budget.maxLessons}"
        )
    if section_count < budget.minSections or section_count > budget.maxSections:
        issues.append(
            f"section count {section_count} is outside budget range "
            f"{budget.minSections}-{budget.maxSections}"
        )
    return issues


def _surface_complexity_score(ctx: RepoContext, analysis: dict[str, Any]) -> int:
    text = " ".join(
        [
            ctx.summary,
            json.dumps(analysis, ensure_ascii=False, sort_keys=True),
            " ".join(ctx.tree[:2_000]),
        ]
    ).lower()
    keywords = {
        "agent",
        "mcp",
        "plugin",
        "provider",
        "daemon",
        "bridge",
        "worker",
        "protocol",
        "remote",
        "streaming",
        "permission",
        "policy",
        "sdk",
        "reconcile",
    }
    matched = {word for word in keywords if re.search(rf"\b{re.escape(word)}\b", text)}
    package_roots = {
        part
        for path in ctx.tree
        for part in path.split("/")[:2]
        if part in {"packages", "apps", "crates", "services", "plugins", "extensions"}
    }
    return min(3, len(matched) // 3) + min(2, len(package_roots))


def _section_range(target: int) -> tuple[int, int]:
    if target <= 4:
        return 1, 2
    if target <= 7:
        return 2, 3
    if target <= 12:
        return 3, 5
    if target <= 16:
        return 4, 6
    return 5, 7


def _list_len(value: Any) -> int:
    return len(value) if isinstance(value, list) else 0


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))
