from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings
from app.main import create_app
from app.services import jobs as jobs_module
from app.services.jobs import JobManager


@pytest.fixture()
def isolated_app(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("R2L_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("R2L_MOCK", "1")
    get_settings.cache_clear()
    settings = Settings(R2L_DATA_DIR=tmp_path, R2L_MOCK=True)
    manager = JobManager(settings)
    monkeypatch.setattr(jobs_module, "job_manager", manager)

    # Route modules import job_manager directly, so patch those references too.
    import app.api.dashboard as dashboard_api
    import app.api.generate as generate_api
    import app.api.jobs as jobs_api

    monkeypatch.setattr(dashboard_api, "job_manager", manager)
    monkeypatch.setattr(generate_api, "job_manager", manager)
    monkeypatch.setattr(jobs_api, "job_manager", manager)

    app = create_app()
    return app, manager


@pytest.mark.asyncio
async def test_generate_dashboard_and_course_flow(isolated_app) -> None:
    app, _manager = isolated_app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _manager.startup()
        try:
            res = await client.post("/api/generate", json={"repoUrl": "https://github.com/chalk/chalk"})
            assert res.status_code == 200
            body = res.json()
            assert body["ready"] is False
            assert body["repoId"] == "chalk-65b538"
            job_id = body["id"]

            for _ in range(80):
                state = (await client.get(f"/api/jobs/{job_id}")).json()
                if state["status"] == "done":
                    break
                await asyncio.sleep(0.02)
            assert state["status"] == "done"
            assert state["lessonsDone"] == 2

            dashboard = (await client.get("/api/dashboard")).json()
            assert dashboard["courses"][0]["repoId"] == "chalk-65b538"

            course = (await client.get("/api/courses/chalk-65b538")).json()
            assert course["outline"]["course"]["repo"]["name"] == "chalk"
            assert course["lessons"]["s01"]["status"] == "ok"

            ready = (await client.post("/api/generate", json={"repoUrl": "https://github.com/chalk/chalk"})).json()
            assert ready == {"ready": True, "repoId": "chalk-65b538"}
        finally:
            pass


@pytest.mark.asyncio
async def test_generate_invalid_json_contract(isolated_app) -> None:
    app, _manager = isolated_app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/generate",
            content="{not-json",
            headers={"content-type": "application/json"},
        )
        assert res.status_code == 400
        assert res.json() == {"error": "invalid JSON body"}
