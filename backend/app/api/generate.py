from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Request

from app.services.jobs import job_manager
from app.services.store import get_course, repo_id_for

router = APIRouter()


def is_repo_url(value: str) -> bool:
    text = value.strip()
    return bool(re.match(r"^https?://[^\s]+", text) or re.match(r"^git@[^\s]+:[^\s]+", text))


@router.post("/generate")
async def generate(request: Request) -> dict[str, object]:
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid JSON body"}) from exc

    repo_url = str(body.get("repoUrl") or "").strip() if isinstance(body, dict) else ""
    if not repo_url:
        raise HTTPException(status_code=400, detail={"error": "repoUrl is required"})
    if not is_repo_url(repo_url):
        raise HTTPException(
            status_code=400,
            detail={"error": "please provide a full git URL, e.g. https://github.com/owner/repo"},
        )

    repo_id = repo_id_for(repo_url)
    if get_course(repo_id) is not None:
        return {"ready": True, "repoId": repo_id}

    running = job_manager.running_id_for(repo_id)
    if running:
        return {"ready": False, "id": running, "repoId": repo_id}

    await job_manager.cleanup_failed_for_repo(repo_id)
    job_id = job_manager.create(repo_url, repo_id)
    return {"ready": False, "id": job_id, "repoId": repo_id}
