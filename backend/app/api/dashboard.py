from __future__ import annotations

from fastapi import APIRouter

from app.services.jobs import job_manager
from app.services.store import list_courses

router = APIRouter()


@router.get("/dashboard")
async def dashboard() -> dict[str, object]:
    running = [
        {
            "id": record.id,
            "repoId": record.repoId,
            "repoUrl": record.repoUrl,
            "stage": record.stage,
            "lessonsDone": record.lessonsDone,
            "lessonsTotal": record.lessonsTotal,
            "startedAt": record.startedAt,
        }
        for record in job_manager.list_running_merged()
    ]
    failed = [
        {
            "id": record.id,
            "repoId": record.repoId,
            "repoUrl": record.repoUrl,
            "errorMsg": record.error or "",
            "updatedAt": record.updatedAt,
            "stage": record.stage,
            "lessonsDone": record.lessonsDone,
            "lessonsTotal": record.lessonsTotal,
        }
        for record in job_manager.list_failed()
    ]
    courses = [item.model_dump(mode="json", exclude_none=True) for item in list_courses()]
    return {"running": running, "failed": failed, "courses": courses}

