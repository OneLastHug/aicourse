from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse

from app.api import codex, courses, dashboard, generate, jobs
from app.core.config import get_settings
from app.services.jobs import job_manager


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        settings = get_settings()
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        await job_manager.startup()
        yield

    app = FastAPI(title="AICourse Python Backend", version="0.1.0", lifespan=lifespan)

    @app.exception_handler(HTTPException)
    async def _http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict):
            return JSONResponse(exc.detail, status_code=exc.status_code)
        return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    api_prefix = "/api"
    app.include_router(generate.router, prefix=api_prefix)
    app.include_router(dashboard.router, prefix=api_prefix)
    app.include_router(courses.router, prefix=api_prefix)
    app.include_router(jobs.router, prefix=api_prefix)
    app.include_router(codex.router, prefix=api_prefix)
    return app


app = create_app()
