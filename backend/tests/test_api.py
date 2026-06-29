from __future__ import annotations

import asyncio
import json
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
    monkeypatch.setenv("R2L_ASSISTANT_MOCK", "1")
    get_settings.cache_clear()
    settings = Settings(R2L_DATA_DIR=tmp_path, R2L_MOCK=True, R2L_ASSISTANT_MOCK=True)
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


@pytest.mark.asyncio
async def test_codex_query_returns_teacher_answer_in_sidebar_mock_mode(isolated_app) -> None:
    app, _manager = isolated_app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/codex/query",
            json={
                "question": "解释这段",
                "mode": "explain",
                "context": {
                    "repoId": "demo",
                    "locale": "zh",
                    "courseTitle": "Demo Course",
                    "lessonId": "s01",
                    "lessonTitle": "Agent 循环",
                    "selectionText": "while true",
                    "selectionKind": "code",
                    "surroundingText": "while true keeps the model/tool loop running",
                    "codeFile": "src/loop.ts",
                    "codeLanguage": "ts",
                },
                "history": [],
            },
        )

        assert res.status_code == 200
        body = res.json()
        assert "先说结论" in body["answer"]
        assert body["provider"] == "local"
        assert body["highlights"]
        assert body["followUps"]


@pytest.mark.asyncio
async def test_codex_sidebar_api_uses_isolated_endpoint_model_and_pool(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.assistant as assistant_module

    calls: list[dict[str, object]] = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "answer": "侧边栏回答",
                                        "summary": "总结",
                                        "highlights": ["固定模型"],
                                        "followUps": ["继续问"],
                                        "references": [{"label": "当前 lesson"}],
                                    },
                                    ensure_ascii=False,
                                )
                            }
                        }
                    ]
                },
                ensure_ascii=False,
            ).encode("utf-8")

    def fake_urlopen(req, timeout: float):
        calls.append(
            {
                "url": req.full_url,
                "payload": json.loads(req.data.decode("utf-8")),
                "timeout": timeout,
            }
        )
        return FakeResponse()

    monkeypatch.setattr(assistant_module.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setenv("R2L_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("R2L_MOCK", "1")
    monkeypatch.setenv("R2L_CODEX_MODEL", "host-codex-model")
    monkeypatch.delenv("R2L_ASSISTANT_MOCK", raising=False)
    get_settings.cache_clear()
    settings = Settings(
        R2L_DATA_DIR=tmp_path,
        R2L_MOCK=True,
        R2L_CODEX_MODEL="host-codex-model",
    )
    manager = JobManager(settings)
    monkeypatch.setattr(jobs_module, "job_manager", manager)

    import app.api.dashboard as dashboard_api
    import app.api.generate as generate_api
    import app.api.jobs as jobs_api

    monkeypatch.setattr(dashboard_api, "job_manager", manager)
    monkeypatch.setattr(generate_api, "job_manager", manager)
    monkeypatch.setattr(jobs_api, "job_manager", manager)
    app = create_app()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/codex/query",
            json={
                "question": "解释",
                "mode": "explain",
                "context": {"locale": "zh", "selectionText": "while true"},
                "history": [],
            },
        )

    assert res.status_code == 200
    assert res.json()["provider"] == "codex-sidebar"
    assert calls == [
        {
            "url": "https://codex.ciii.club/v1/chat/completions",
            "payload": {
                "model": "gpt-5.4-mini",
                "messages": calls[0]["payload"]["messages"],
                "temperature": 0.2,
            },
            "timeout": 90.0,
        }
    ]
    assert calls[0]["payload"]["model"] != settings.r2l_codex_model
    assert assistant_module._sidebar_executor._max_workers == 3
