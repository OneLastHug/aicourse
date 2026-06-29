from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.events import is_terminal_event, sse_data
from app.services.jobs import job_manager

router = APIRouter()


@router.get("/jobs/{job_id}")
async def job(job_id: str) -> JSONResponse:
    state = job_manager.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail={"error": "job not found"})
    return JSONResponse(state.model_dump(mode="json", exclude_none=True))


@router.get("/jobs/{job_id}/lessons/{lesson_id}")
async def lesson_draft(job_id: str, lesson_id: str) -> JSONResponse:
    draft = job_manager.get_draft(job_id, lesson_id)
    if draft is None:
        raise HTTPException(status_code=404, detail={"error": "draft not ready"})
    return JSONResponse(draft)


@router.get("/jobs/{job_id}/stream")
async def job_stream(job_id: str) -> StreamingResponse:
    state = job_manager.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail={"error": "job not found"})

    async def events():
        for event in state.events:
            yield sse_data(event)

        if state.status in {"done", "error"}:
            return

        queue = await job_manager.subscribe(job_id)
        if queue is None:
            return
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    yield ": ping\n\n"
                    continue
                if event is None:
                    return
                yield sse_data(event)
                if is_terminal_event(event):
                    return
        finally:
            job_manager.unsubscribe(job_id, queue)

    return StreamingResponse(
        events(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "cache-control": "no-cache, no-transform",
            "connection": "keep-alive",
            "x-accel-buffering": "no",
        },
    )
