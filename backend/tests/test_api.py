from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings
from app.main import create_app
from app.sample.fixtures import build_mock_course
from app.services import jobs as jobs_module
from app.services.jobs import JobManager
from app.services.store import list_job_records, save_job_record


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
async def test_generate_dedupes_canonical_repo_urls(isolated_app, monkeypatch: pytest.MonkeyPatch) -> None:
    app, manager = isolated_app
    release = asyncio.Event()

    async def fake_generate_course(repo_url, _on_progress, _settings):
        await release.wait()
        return build_mock_course(repo_url)

    monkeypatch.setattr(jobs_module, "generate_course", fake_generate_course)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first = (
            await client.post(
                "/api/generate",
                json={"repoUrl": "https://github.com/EvoMap/evolver.git"},
            )
        ).json()
        second = (
            await client.post(
                "/api/generate",
                json={"repoUrl": "https://github.com/EvoMap/evolver"},
            )
        ).json()

        assert first["ready"] is False
        assert second["ready"] is False
        assert first["id"] == second["id"]
        assert first["repoId"] == "evolver-655c54"
        assert second["repoId"] == "evolver-655c54"
        assert manager.get(first["id"]).repoUrl == "https://github.com/evomap/evolver"

        dashboard = (await client.get("/api/dashboard")).json()
        assert [item["repoId"] for item in dashboard["running"]] == ["evolver-655c54"]

        release.set()
        for _ in range(40):
            state = manager.get(first["id"])
            if state and state.status == "done":
                break
            await asyncio.sleep(0.02)
        assert manager.get(first["id"]).status == "done"


@pytest.mark.asyncio
async def test_auto_retry_collapses_legacy_canonical_duplicates(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(R2L_DATA_DIR=tmp_path, R2L_MOCK=True)
    manager = JobManager(settings)
    release = asyncio.Event()

    async def fake_generate_course(repo_url, _on_progress, _settings):
        await release.wait()
        return build_mock_course(repo_url)

    monkeypatch.setattr(jobs_module, "generate_course", fake_generate_course)
    ts = jobs_module.now_ms()
    save_job_record(
        {
            "id": "old-git",
            "repoUrl": "https://github.com/EvoMap/evolver.git",
            "repoId": "evolver-6472be",
            "status": "error",
            "stage": "ingest",
            "lessonsDone": 0,
            "lessonsTotal": 0,
            "error": "fatal: Cannot fast-forward to multiple branches.",
            "startedAt": ts - 2,
            "updatedAt": ts - 2,
        },
        settings,
    )
    save_job_record(
        {
            "id": "old-no-git",
            "repoUrl": "https://github.com/EvoMap/evolver",
            "repoId": "evolver-939642",
            "status": "error",
            "stage": "analyze",
            "lessonsDone": 0,
            "lessonsTotal": 0,
            "error": "provider blocked",
            "startedAt": ts - 1,
            "updatedAt": ts - 1,
        },
        settings,
    )

    await manager.auto_retry()

    records = list_job_records(settings)
    running = [record for record in records if record.status == "running"]
    failed = [record for record in records if record.status == "error"]
    assert len(running) == 1
    assert failed == []
    assert running[0].repoId == "evolver-655c54"
    assert running[0].repoUrl == "https://github.com/evomap/evolver"

    release.set()
    for _ in range(40):
        state = manager.get(running[0].id)
        if state and state.status == "done":
            break
        await asyncio.sleep(0.02)
    assert manager.get(running[0].id).status == "done"


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
    monkeypatch.setenv("R2L_ASSISTANT_ENDPOINT", "https://assistant.example.invalid/v1/chat/completions")
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
            "url": "https://assistant.example.invalid/v1/chat/completions",
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


@pytest.mark.asyncio
async def test_codex_sidebar_api_supports_responses_endpoint(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.assistant as assistant_module

    calls: list[dict[str, object]] = []

    class FakeHttpxResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {
                "output_text": json.dumps(
                    {
                        "answer": "responses 回答",
                        "summary": "responses 总结",
                        "highlights": ["responses"],
                        "followUps": ["继续"],
                        "references": [{"label": "当前 lesson", "href": None}],
                    },
                    ensure_ascii=False,
                )
            }

    class FakeHttpxClient:
        def __init__(self, timeout: float):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def post(self, url: str, json: dict[str, object], headers: dict[str, str]):
            calls.append(
                {
                    "url": url,
                    "payload": json,
                    "headers": headers,
                    "timeout": self.timeout,
                }
            )
            return FakeHttpxResponse()

    monkeypatch.setattr(assistant_module.httpx, "Client", FakeHttpxClient)
    settings = Settings(
        R2L_DATA_DIR=tmp_path,
        R2L_ASSISTANT_ENDPOINT="https://assistant.example.invalid/v1/responses",
        R2L_ASSISTANT_MODEL="gpt-5.4-mini",
    )

    result = await assistant_module.answer_question(
        assistant_module.AssistantRequest(
            question="解释",
            context=assistant_module.AssistantContext(selectionText="const x = 1 + 2"),
        ),
        settings,
    )

    assert result.provider == "codex-sidebar"
    assert result.summary == "responses 总结"
    assert calls[0]["url"] == "https://assistant.example.invalid/v1/responses"
    payload = calls[0]["payload"]
    assert isinstance(payload, dict)
    assert payload["model"] == "gpt-5.4-mini"
    assert "input" in payload
    assert "messages" not in payload
    assert payload["text"]["format"]["type"] == "json_schema"


@pytest.mark.asyncio
async def test_codex_sidebar_responses_unwraps_nested_json_and_preserves_code_blocks(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.assistant as assistant_module

    inner = {
        "answer": "先说结论：这里会创建常量。\n\n```ts\nconst x = 1;\n```\n\n下一步可以改成变量试试。",
        "summary": "保留代码块",
        "highlights": ["代码块"],
        "followUps": ["逐行解释"],
        "references": [{"label": "当前 lesson", "href": None}],
    }
    outer = {
        "answer": json.dumps(inner, ensure_ascii=False),
        "summary": "外层摘要",
        "highlights": [],
        "followUps": [],
        "references": [],
    }

    class FakeHttpxResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": json.dumps(outer, ensure_ascii=False),
                            }
                        ],
                    }
                ]
            }

    class FakeHttpxClient:
        def __init__(self, timeout: float):
            assert timeout == 90.0

        def __enter__(self):
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def post(self, *_args, **_kwargs):
            return FakeHttpxResponse()

    monkeypatch.setattr(assistant_module.httpx, "Client", FakeHttpxClient)
    settings = Settings(
        R2L_DATA_DIR=tmp_path,
        R2L_ASSISTANT_ENDPOINT="https://assistant.example.invalid/v1/responses",
        R2L_ASSISTANT_MODEL="gpt-5.4-mini",
    )

    result = await assistant_module.answer_question(
        assistant_module.AssistantRequest(
            question="解释代码",
            context=assistant_module.AssistantContext(selectionKind="code", selectionText="const x = 1"),
        ),
        settings,
    )

    assert result.provider == "codex-sidebar"
    assert result.summary == "保留代码块"
    assert "```ts\nconst x = 1;\n```" in result.answer
    assert '"answer"' not in result.answer


@pytest.mark.asyncio
async def test_codex_sidebar_does_not_call_provider_without_endpoint(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.assistant as assistant_module

    def fail_urlopen(*_args, **_kwargs):
        raise AssertionError("provider should not be called without R2L_ASSISTANT_ENDPOINT")

    monkeypatch.setattr(assistant_module.urllib.request, "urlopen", fail_urlopen)
    settings = Settings(R2L_DATA_DIR=tmp_path)

    result = await assistant_module.answer_question(
        assistant_module.AssistantRequest(
            question="解释",
            context=assistant_module.AssistantContext(selectionText="while true"),
        ),
        settings,
    )

    assert result.provider == "local"
