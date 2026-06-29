from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.store import get_course_raw, list_courses

router = APIRouter()


@router.get("/courses")
async def courses() -> dict[str, object]:
    return {
        "courses": [
            item.model_dump(mode="json", exclude_none=True)
            for item in list_courses()
        ]
    }


@router.get("/courses/{repo_id}")
async def course(repo_id: str) -> dict[str, object]:
    data = get_course_raw(repo_id)
    if data is None:
        raise HTTPException(status_code=404, detail={"error": "course not found"})
    return data

