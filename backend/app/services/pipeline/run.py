from __future__ import annotations

from typing import Any

from app.core.config import Settings
from app.services.cache import Cache
from app.services.codex_driver import CliCodexDriver
from app.services.observability import current_observability, short_hash
from app.services.pipeline.analyze import run_analyze_stage
from app.services.pipeline.curriculum import run_curriculum_stage
from app.services.pipeline.lesson import run_lesson_stage
from app.services.pipeline.repair import repair_zh_validation_round
from app.services.pipeline.run_types import ProgressCallback
from app.services.pipeline.spine import emit_zh_spine_events
from app.services.pipeline.translate import run_translate_stage
from app.services.pipeline.validate import (
    CourseValidationError,
    validate_course_alignment,
    validate_course_schema,
    validate_zh_course_alignment,
    validate_zh_course_schema,
)
from app.services.repo import ingest_repo


async def run_pipeline(
    repo_url: str,
    on_progress: ProgressCallback,
    settings: Settings,
    cache_bust: str | None = None,
) -> dict[str, Any]:
    """Chinese-first real Python pipeline.

    Browser-facing APIs stay stable. Internally the generation stages now match
    the TypeScript v2 contract: Chinese outline and lessons are generated first,
    validated, then translated into the final bilingual Course JSON.
    """

    obs = current_observability()

    with obs.span("ingest", metadata={"repo_url_hash": short_hash(repo_url)}):
        await on_progress({"type": "stage", "stage": "ingest", "label": "Cloning & mapping the repo"})
        ctx = await ingest_repo(repo_url, settings)
        obs.event(
            "repo.ingested",
            metadata={
                "repo_name_hash": short_hash(ctx.name),
                "repo_sha_hash": short_hash(ctx.sha),
                "file_count": len(ctx.tree),
                "loc": ctx.loc,
            },
        )
    cache = Cache.from_settings(settings)
    driver = CliCodexDriver(settings)

    await on_progress(
        {
            "type": "log",
            "level": "info",
            "message": f"repo ingested: {ctx.name}@{ctx.sha} · {len(ctx.tree)} files · {ctx.loc} LOC",
        }
    )

    with obs.span("analyze", metadata={"repo_sha_hash": short_hash(ctx.sha)}):
        await on_progress({"type": "stage", "stage": "analyze", "label": "Deep-reading the actual codebase"})
        analysis = await run_analyze_stage(ctx=ctx, driver=driver, cache=cache, settings=settings)

    with obs.span("curriculum", metadata={"cache_bust": bool(cache_bust)}):
        await on_progress({"type": "stage", "stage": "curriculum", "label": "Designing the layered curriculum"})
        zh_outline = await run_curriculum_stage(
            ctx=ctx,
            analysis=analysis,
            driver=driver,
            cache=cache,
            settings=settings,
            cache_bust=cache_bust,
        )
        obs.event(
            "curriculum.outline",
            metadata={
                "lesson_count": len(zh_outline.lessons),
                "section_count": len(zh_outline.sections),
            },
        )

    with obs.span("lessons", metadata={"lesson_count": len(zh_outline.lessons)}):
        await on_progress({"type": "stage", "stage": "lessons", "label": "Writing the Chinese course"})
        await on_progress(
            {
                "type": "plan",
                "total": len(zh_outline.lessons),
                "lessons": [
                    {
                        "id": lesson.id,
                        "title": {"zh": lesson.title, "en": ""},
                        "difficulty": lesson.difficulty,
                    }
                    for lesson in zh_outline.lessons
                ],
            }
        )
        zh_lessons = await run_lesson_stage(
            ctx=ctx,
            outline=zh_outline,
            driver=driver,
            cache=cache,
            settings=settings,
            on_progress=on_progress,
            cache_bust=cache_bust,
        )

    with obs.span("spine", metadata={"lesson_count": len(zh_lessons)}):
        await on_progress({"type": "stage", "stage": "spine", "label": "Materializing the runnable spine"})
        await emit_zh_spine_events(zh_lessons, on_progress)

    if settings.r2l_validate:
        with obs.span("validate1", metadata={"round": 1, "scope": "schema"}):
            await on_progress({"type": "stage", "stage": "validate1", "label": "Chinese course quality validation"})
            issues = validate_zh_course_schema(zh_outline, zh_lessons)
            _record_validation_result(obs, round_no=1, scope="global", issues=issues)
            if issues:
                await on_progress({"type": "validation", "round": 1, "passed": False, "issueCount": len(issues)})
                await on_progress({"type": "log", "level": "warn", "message": "; ".join(issues)})
                zh_lessons, issues = await repair_zh_validation_round(
                    round_no=1,
                    ctx=ctx,
                    outline=zh_outline,
                    lessons=zh_lessons,
                    issues=issues,
                    driver=driver,
                    settings=settings,
                    on_progress=on_progress,
                )
                _record_validation_result(obs, round_no=1, scope="post_repair_global", issues=issues)
                if issues:
                    await on_progress({"type": "log", "level": "error", "message": "; ".join(issues)})
                    raise CourseValidationError("; ".join(issues))
            await on_progress({"type": "validation", "round": 1, "passed": True, "issueCount": 0})

        with obs.span("validate2", metadata={"round": 2, "scope": "alignment"}):
            await on_progress({"type": "stage", "stage": "validate2", "label": "Repository alignment validation"})
            issues = validate_zh_course_alignment(zh_outline, zh_lessons, ctx)
            _record_validation_result(obs, round_no=2, scope="global", issues=issues)
            if issues:
                await on_progress({"type": "validation", "round": 2, "passed": False, "issueCount": len(issues)})
                await on_progress({"type": "log", "level": "warn", "message": "; ".join(issues)})
                zh_lessons, issues = await repair_zh_validation_round(
                    round_no=2,
                    ctx=ctx,
                    outline=zh_outline,
                    lessons=zh_lessons,
                    issues=issues,
                    driver=driver,
                    settings=settings,
                    on_progress=on_progress,
                )
                _record_validation_result(obs, round_no=2, scope="post_repair_global", issues=issues)
                if issues:
                    await on_progress({"type": "log", "level": "error", "message": "; ".join(issues)})
                    raise CourseValidationError("; ".join(issues))
            await on_progress({"type": "validation", "round": 2, "passed": True, "issueCount": 0})
    else:
        with obs.span("validate1", metadata={"skipped": True}):
            await on_progress({"type": "stage", "stage": "validate1", "label": "Validation skipped (R2L_VALIDATE=0)"})
            await on_progress({"type": "validation", "round": 1, "passed": True, "issueCount": 0})
            obs.event("validation.skipped", metadata={"round": 1})
        with obs.span("validate2", metadata={"skipped": True}):
            await on_progress({"type": "stage", "stage": "validate2", "label": "Validation skipped (R2L_VALIDATE=0)"})
            await on_progress({"type": "validation", "round": 2, "passed": True, "issueCount": 0})
            obs.event("validation.skipped", metadata={"round": 2})

    with obs.span("translate", metadata={"with_codex": settings.r2l_translate_with_codex}):
        await on_progress({"type": "stage", "stage": "translate", "label": "Translating the Chinese course to English"})
        course = await run_translate_stage(
            ctx=ctx,
            zh_outline=zh_outline,
            zh_lessons=zh_lessons,
            driver=driver,
            cache=cache,
            settings=settings,
            cache_bust=cache_bust,
        )

    with obs.span("final_validation"):
        issues = validate_course_schema(course)
        _record_validation_result(obs, round_no=3, scope="final_schema", issues=issues)
        if issues:
            await on_progress({"type": "log", "level": "error", "message": "; ".join(issues)})
            raise CourseValidationError("; ".join(issues))
        alignment_issues = validate_course_alignment(course, ctx)
        _record_validation_result(obs, round_no=4, scope="final_alignment", issues=alignment_issues)
        if alignment_issues:
            await on_progress({"type": "log", "level": "error", "message": "; ".join(alignment_issues)})
            raise CourseValidationError("; ".join(alignment_issues))

    await on_progress({"type": "stage", "stage": "done", "label": "Done"})
    return course.model_dump(mode="json", exclude_none=True)


def _record_validation_result(obs, *, round_no: int, scope: str, issues: list[str]) -> None:
    obs.event(
        "validation.result",
        metadata={
            "round": round_no,
            "scope": scope,
            "passed": not issues,
            "issue_count": len(issues),
            "issue_types": _issue_types(issues),
        },
    )
    obs.score(f"validation.{scope}.passed", 1 if not issues else 0)


def _issue_types(issues: list[str]) -> list[str]:
    kinds = set()
    for issue in issues:
        text = issue.lower()
        if "mermaid" in text:
            kinds.add("mermaid")
        elif "snippet" in text:
            kinds.add("snippet")
        elif "missing path" in text or "references missing path" in text:
            kinds.add("missing_path")
        elif "title" in text:
            kinds.add("title")
        elif "simulation" in text or "practice" in text:
            kinds.add("interaction")
        elif "align" in text or "file" in text:
            kinds.add("alignment")
        else:
            kinds.add("quality")
    return sorted(kinds)
