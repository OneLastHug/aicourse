from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from app.core.config import Settings, get_settings
from app.core.events import validate_progress_event
from app.core.schemas import CourseMeta, JobRecord, JobState
from app.services.generator import generate_course
from app.services.store import (
    get_meta,
    list_job_records,
    remove_course,
    remove_job_record,
    remove_repo_clone,
    save_course,
    save_job_record,
)


def now_ms() -> int:
    return int(time.time() * 1000)


def progress_score_for_stage(stage: str, lessons_done: int) -> int:
    order = [
        "queued",
        "ingest",
        "analyze",
        "curriculum",
        "lessons",
        "spine",
        "validate1",
        "validate2",
        "translate",
        "done",
    ]
    try:
        idx = order.index(stage)
    except ValueError:
        idx = 0
    return idx * 1000 + lessons_done


@dataclass
class Job:
    state: JobState
    drafts: dict[str, Any] = field(default_factory=dict)
    subscribers: set[asyncio.Queue[dict[str, Any] | None]] = field(default_factory=set)


class JobManager:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.jobs: dict[str, Job] = {}
        self.running_by_repo: dict[str, str] = {}
        self._background_started = False

    async def startup(self) -> None:
        await self.reconcile()
        if not self._background_started:
            self._background_started = True
            asyncio.create_task(self._auto_retry_loop())
            asyncio.create_task(self._auto_cleanup_loop())

    async def reconcile(self) -> None:
        for record in list_job_records(self.settings):
            if record.status == "running":
                record.status = "error"
                record.error = "interrupted (server restarted)"
                record.updatedAt = now_ms()
                save_job_record(record, self.settings)

    def create(self, repo_url: str, repo_id: str) -> str:
        job_id = str(uuid.uuid4())
        ts = now_ms()
        state = JobState(
            id=job_id,
            repoUrl=repo_url,
            repoId=repo_id,
            status="running",
            stage="queued",
            lessonsDone=0,
            lessonsTotal=0,
            events=[],
            startedAt=ts,
            updatedAt=ts,
        )
        self.jobs[job_id] = Job(state=state)
        self.running_by_repo[repo_id] = job_id
        save_job_record(state, self.settings)
        asyncio.create_task(self._run(job_id, repo_id))
        return job_id

    def running_id(self, repo_id: str) -> str | None:
        job_id = self.running_by_repo.get(repo_id)
        if job_id and self.jobs.get(job_id, None) and self.jobs[job_id].state.status == "running":
            return job_id
        return None

    def running_id_for(self, repo_id: str) -> str | None:
        in_memory = self.running_id(repo_id)
        if in_memory:
            return in_memory
        for record in list_job_records(self.settings):
            if record.repoId == repo_id and record.status == "running":
                job = self.jobs.get(record.id)
                if job is None or job.state.status == "running":
                    return record.id
        return None

    def get(self, job_id: str) -> JobState | None:
        job = self.jobs.get(job_id)
        return job.state if job else None

    def get_draft(self, job_id: str, lesson_id: str) -> Any | None:
        job = self.jobs.get(job_id)
        if job is None:
            return None
        return job.drafts.get(lesson_id)

    def list_running(self) -> list[JobState]:
        return [job.state for job in self.jobs.values() if job.state.status == "running"]

    def list_running_merged(self) -> list[JobRecord]:
        by_id: dict[str, JobRecord] = {
            record.id: record for record in list_job_records(self.settings) if record.status == "running"
        }
        for state in self.list_running():
            by_id[state.id] = JobRecord.model_validate(state.model_dump(mode="json", exclude={"events"}))
        for job_id in list(by_id):
            state = self.get(job_id)
            if state and state.status != "running":
                del by_id[job_id]
        return sorted(by_id.values(), key=lambda item: item.startedAt, reverse=True)

    def list_failed(self) -> list[JobRecord]:
        cutoff = now_ms() - 24 * 60 * 60 * 1000
        return [
            record
            for record in list_job_records(self.settings)
            if record.status == "error" and record.updatedAt > cutoff
        ]

    async def subscribe(self, job_id: str) -> asyncio.Queue[dict[str, Any] | None] | None:
        job = self.jobs.get(job_id)
        if job is None:
            return None
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        job.subscribers.add(queue)
        return queue

    def unsubscribe(self, job_id: str, queue: asyncio.Queue[dict[str, Any] | None]) -> None:
        job = self.jobs.get(job_id)
        if job is not None:
            job.subscribers.discard(queue)

    async def emit(self, job_id: str, event: dict[str, Any]) -> None:
        job = self.jobs.get(job_id)
        if job is None:
            return
        event = validate_progress_event(event)
        if event.get("type") == "lessonDraft":
            lesson_id = str(event.get("id", ""))
            if lesson_id:
                job.drafts[lesson_id] = event.get("body")
            return

        job.state.events.append(event)
        event_type = event.get("type")
        if event_type == "stage":
            job.state.stage = str(event.get("stage", job.state.stage))
        elif event_type == "plan":
            job.state.lessonsTotal = int(event.get("total", 0))
        elif event_type == "lesson" and event.get("status") in {"ok", "failed"}:
            job.state.lessonsDone += 1
        elif event_type == "error":
            job.state.error = str(event.get("message", ""))

        job.state.updatedAt = now_ms()
        for queue in list(job.subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                job.subscribers.discard(queue)

        if self._should_persist(event):
            save_job_record(job.state, self.settings)

    @staticmethod
    def _should_persist(event: dict[str, Any]) -> bool:
        event_type = event.get("type")
        return (
            event_type in {"stage", "plan", "error"}
            or (event_type == "lesson" and event.get("status") in {"ok", "failed"})
        )

    async def _run(self, job_id: str, repo_id: str) -> None:
        job = self.jobs.get(job_id)
        if job is None:
            return
        try:
            course = await generate_course(
                job.state.repoUrl,
                lambda event: self.emit(job_id, event),
                self.settings,
            )
            outline = course["outline"]
            course_info = outline["course"]
            lessons = outline["lessons"]
            job.state.repoTitle = course_info["title"]["en"]
            job.state.lessonsTotal = len(lessons)
            job.state.status = "done"
            job.state.stage = "done"
            job.state.updatedAt = now_ms()
            meta = CourseMeta(
                repoId=repo_id,
                url=job.state.repoUrl,
                name=course_info["repo"]["name"],
                title=course_info["title"]["en"],
                createdAt=datetime.now(tz=UTC).isoformat().replace("+00:00", "Z"),
                lessonCount=len(lessons),
            )
            save_course(repo_id, course, meta, self.settings)
            save_job_record(job.state, self.settings)
        except Exception as exc:
            job.state.status = "error"
            job.state.error = str(exc)
            job.state.updatedAt = now_ms()
            await self.emit(job_id, {"type": "error", "message": str(exc)})
            save_job_record(job.state, self.settings)
        finally:
            self.running_by_repo.pop(repo_id, None)
            for queue in list(job.subscribers):
                queue.put_nowait(None)

    async def cleanup_failed_for_repo(self, repo_id: str) -> None:
        for record in list_job_records(self.settings):
            if record.repoId == repo_id and record.status == "error":
                remove_job_record(record.id, self.settings)

    async def auto_retry(self) -> None:
        failed = self.list_failed()
        if not failed:
            return

        by_repo: dict[str, list[JobRecord]] = {}
        for record in failed:
            by_repo.setdefault(record.repoId, []).append(record)

        for repo_id, records in by_repo.items():
            if get_meta(repo_id, self.settings):
                for record in records:
                    remove_job_record(record.id, self.settings)
                continue

            records.sort(
                key=lambda item: progress_score_for_stage(item.stage, item.lessonsDone),
                reverse=True,
            )
            keeper = records[0]
            for record in records[1:]:
                remove_job_record(record.id, self.settings)

            if self.running_id_for(repo_id):
                continue
            self.create(keeper.repoUrl, repo_id)

    async def auto_cleanup(self) -> None:
        cutoff = now_ms() - 24 * 60 * 60 * 1000
        for record in list_job_records(self.settings):
            if record.updatedAt < cutoff:
                remove_job_record(record.id, self.settings)
                if not get_meta(record.repoId, self.settings):
                    remove_repo_clone(record.repoUrl, self.settings)
                    remove_course(record.repoId, self.settings)

    async def _auto_retry_loop(self) -> None:
        await asyncio.sleep(30)
        while True:
            try:
                await self.auto_retry()
            except Exception:
                pass
            await asyncio.sleep(10 * 60)

    async def _auto_cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(60 * 60)
            try:
                await self.auto_cleanup()
            except Exception:
                pass


job_manager = JobManager()
