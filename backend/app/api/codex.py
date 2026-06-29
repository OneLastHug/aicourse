from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.services.assistant import AssistantRequest, answer_question

router = APIRouter()


@router.post("/codex/query")
async def codex_query(request: Request) -> dict[str, object]:
    try:
        body = await request.json()
        payload = AssistantRequest.model_validate(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid assistant request"}) from exc

    result = await answer_question(payload)
    return result.model_dump(mode="json", exclude_none=True)

