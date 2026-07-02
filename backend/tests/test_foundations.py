from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.config import Settings
from app.sample.fixtures import build_mock_course
from app.services.cache import Cache
from app.services.codex_driver import CodexResult, generation_codex_env
from app.services.generator import generate_course
from app.services.json_parse import extract_json
from app.services.pipeline.call import get_generation_limiter
from app.services.pipeline.validate import (
    CourseValidationError,
    validate_course_alignment,
    validate_course_schema,
    validate_mermaid_text,
    validate_zh_course_alignment,
    validate_zh_course_schema,
)
from app.services.repo import ingest_repo


def _zh_from_bi(value):
    if isinstance(value, dict):
        if set(value) == {"zh", "en"}:
            return value["zh"]
        return {key: _zh_from_bi(item) for key, item in value.items() if key not in {"keyFiles"}}
    if isinstance(value, list):
        return [_zh_from_bi(item) for item in value]
    return value


def _zh_outline_from_fixture(fixture: dict[str, object]) -> dict[str, object]:
    outline = _zh_from_bi(fixture["outline"])
    for section in outline["sections"]:
        for lesson in section["lessons"]:
            lesson["filesToRead"] = fixture_lesson_files(fixture, lesson["id"])
    outline["lessons"] = [lesson for section in outline["sections"] for lesson in section["lessons"]]
    return outline


def fixture_lesson_files(fixture: dict[str, object], lesson_id: str) -> list[str]:
    for lesson in fixture["outline"]["lessons"]:
        if lesson["id"] == lesson_id:
            return list(lesson["keyFiles"])
    return []


def write_fixture_repo_files(repo: Path) -> None:
    files = {
        "src/index.ts": "payload = await request.json()\nrepo_url = payload.get('repoUrl', '').strip()\n",
        "backend/app/api/generate.py": "payload = await request.json()\nrepo_url = payload.get('repoUrl', '').strip()\n",
        "backend/app/services/jobs.py": (
            "job_id = job_manager.create(repo_url, repo_id)\n"
            "return {'ready': False, 'id': job_id}\n"
            "for event in job.state.events:\n"
            "    yield sse(event)\n"
            "async for event in subscribe:\n"
            "    yield sse(event)\n"
        ),
        "site/lib/server/jobs.ts": (
            "job_id = job_manager.create(repo_url, repo_id)\n"
            "return {'ready': False, 'id': job_id}\n"
            "for event in job.state.events:\n"
            "    yield sse(event)\n"
            "async for event in subscribe:\n"
            "    yield sse(event)\n"
        ),
        "backend/app/services/store.py": "save_job_record(job.state)\nsave_course(repo_id, course, meta)\n",
        "site/lib/server/store.ts": "save_job_record(job.state)\nsave_course(repo_id, course, meta)\n",
    }
    for rel, content in files.items():
        path = repo / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def _zh_lesson_from_fixture(fixture: dict[str, object], lesson_id: str) -> dict[str, object]:
    lesson = _zh_from_bi(fixture["lessons"][lesson_id])
    lesson["filesUsed"] = fixture_lesson_files(fixture, lesson_id)
    return lesson


def test_extract_json_handles_fences_and_relaxed_literals() -> None:
    text = """
    prose
    ```json
    {
      unquoted: 'value',
      list: [1, 2,],
    }
    ```
    """
    assert extract_json(text) == {"unquoted": "value", "list": [1, 2]}


def test_extract_json_preserves_code_fences_inside_json_strings() -> None:
    text = json.dumps(
        {
            "answer": "示例：\n\n```ts\nconst x = 1;\n```",
            "summary": "代码",
        },
        ensure_ascii=False,
    )
    assert extract_json(text)["answer"] == "示例：\n\n```ts\nconst x = 1;\n```"


def test_cache_roundtrip(tmp_path: Path) -> None:
    cache = Cache(tmp_path)
    key = cache.key({"stage": "analyze", "repo": "abc"})
    cache.set(key, {"ok": True})
    assert cache.get(key) == {"ok": True}


def test_generation_defaults_and_pool_are_ten_slots(tmp_path: Path) -> None:
    settings = Settings(R2L_DATA_DIR=tmp_path / "data")
    limiter = get_generation_limiter(settings)

    assert settings.r2l_codex_model == "gpt-5.4"
    assert settings.r2l_codex_reasoning_effort == "xhigh"
    assert settings.r2l_codex_concurrency == 10
    assert settings.r2l_validate is True
    assert limiter._value == 10


def test_generation_validation_env_can_disable_explicitly(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("R2L_VALIDATE", "0")
    settings = Settings(R2L_DATA_DIR=tmp_path / "data")

    assert settings.r2l_validate is False


def test_generation_codex_env_isolated_from_host_codex(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CODEX_HOME", "/host/codex")
    monkeypatch.setenv("OPENAI_API_KEY", "host-secret")
    monkeypatch.setenv("R2L_ASSISTANT_API_KEY", "assistant-secret")
    settings = Settings(
        R2L_DATA_DIR=tmp_path / "data",
        R2L_ASSISTANT_ENDPOINT="https://codex.ciii.club/v1/responses",
        R2L_ASSISTANT_API_KEY="assistant-secret",
    )

    env = generation_codex_env(settings)

    config = (settings.codex_home / "config.toml").read_text(encoding="utf-8")
    auth = json.loads((settings.codex_home / "auth.json").read_text(encoding="utf-8"))

    assert env["CODEX_HOME"] == str(settings.codex_home)
    assert env["HOME"] == str(settings.codex_home)
    assert env["CODEX_HOME"] != "/host/codex"
    assert "OPENAI_API_KEY" not in env
    assert "R2L_ASSISTANT_API_KEY" not in env
    assert 'openai_base_url = "https://codex.ciii.club/v1"' in config
    assert auth == {"auth_mode": "apikey", "OPENAI_API_KEY": "assistant-secret"}


def test_generation_codex_api_key_can_be_separate_from_sidebar(tmp_path: Path) -> None:
    settings = Settings(
        R2L_DATA_DIR=tmp_path / "data",
        R2L_CODEX_BASE_URL="https://codex.ciii.club/v1/",
        R2L_CODEX_API_KEY="generation-secret",
        R2L_ASSISTANT_API_KEY="assistant-secret",
    )

    generation_codex_env(settings)

    auth = json.loads((settings.codex_home / "auth.json").read_text(encoding="utf-8"))
    config = (settings.codex_home / "config.toml").read_text(encoding="utf-8")
    assert auth["OPENAI_API_KEY"] == "generation-secret"
    assert "assistant-secret" not in json.dumps(auth)
    assert 'openai_base_url = "https://codex.ciii.club/v1"' in config


@pytest.mark.asyncio
async def test_ingest_local_repo(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "README.md").write_text("# Demo\n\nHello", encoding="utf-8")
    (repo / "main.py").write_text("print('hi')\n", encoding="utf-8")

    ctx = await ingest_repo(str(repo), Settings(R2L_DATA_DIR=tmp_path / "data", R2L_MOCK=False))

    assert ctx.name == "repo"
    assert ctx.sha == "unknown"
    assert ctx.loc == 1
    assert "main.py" in ctx.tree
    assert ctx.languages["Python"] > 0


@pytest.mark.asyncio
async def test_non_mock_pipeline_can_generate_with_codex_driver(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "README.md").write_text("# Demo", encoding="utf-8")
    write_fixture_repo_files(repo)
    events: list[dict[str, object]] = []

    async def on_progress(event: dict[str, object]) -> None:
        events.append(event)

    class FakeDriver:
        def __init__(self, _settings) -> None:
            self.calls = 0

        async def run(self, call):
            self.calls += 1
            fixture = build_mock_course(str(repo))
            if call.label == "analyze":
                return CodexResult(
                    text='{"summary":"demo","entrypoints":["README.md"],"coreFlows":[],"teachingSpine":"demo","risks":[]}',
                    duration_ms=1,
                )
            if call.label == "curriculum":
                return CodexResult(text=json.dumps(_zh_outline_from_fixture(fixture)), duration_ms=1)
            if call.label == "translate:outline":
                return CodexResult(text=json.dumps(fixture["outline"]), duration_ms=1)
            if call.label.startswith("translate:lesson:"):
                lesson_id = call.label.rsplit(":", 1)[1]
                return CodexResult(text=json.dumps(fixture["lessons"][lesson_id]), duration_ms=1)
            lesson_id = call.label.split(":", 1)[1]
            return CodexResult(text=json.dumps(_zh_lesson_from_fixture(fixture, lesson_id)), duration_ms=1)

    import app.services.pipeline.run as run_module

    monkeypatch.setattr(run_module, "CliCodexDriver", FakeDriver)

    course = await generate_course(
        str(repo),
        on_progress,
        Settings(R2L_DATA_DIR=tmp_path / "data", R2L_MOCK=False),
    )

    assert course["outline"]["course"]["repo"]["name"] == "repo"
    assert any(event.get("type") == "plan" for event in events)
    stages = [event.get("stage") for event in events if event.get("type") == "stage"]
    assert stages == [
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
    assert any(event.get("type") == "spine" and event.get("status") == "ok" for event in events)
    assert any(
        event.get("type") == "validation" and event.get("round") == 2 for event in events
    )
    assert events[-1] == {"type": "stage", "stage": "done", "label": "Done"}


@pytest.mark.asyncio
async def test_non_mock_pipeline_emits_validation_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "README.md").write_text("# Demo", encoding="utf-8")
    events: list[dict[str, object]] = []

    async def on_progress(event: dict[str, object]) -> None:
        events.append(event)

    class FakeDriver:
        def __init__(self, _settings) -> None:
            pass

        async def run(self, call):
            fixture = build_mock_course(str(repo))
            if call.label == "analyze":
                return CodexResult(text='{"summary":"demo"}', duration_ms=1)
            if call.label == "curriculum":
                return CodexResult(text=json.dumps(_zh_outline_from_fixture(fixture)), duration_ms=1)
            if call.label == "translate:outline":
                return CodexResult(text=json.dumps(fixture["outline"]), duration_ms=1)
            if call.label.startswith("translate:lesson:"):
                lesson_id = call.label.rsplit(":", 1)[1]
                return CodexResult(text=json.dumps(fixture["lessons"][lesson_id]), duration_ms=1)
            lesson_id = call.label.split(":", 1)[1]
            lesson = _zh_lesson_from_fixture(fixture, lesson_id)
            if lesson_id == "s02":
                lesson = {**lesson, "status": "failed"}
                lesson.pop("error", None)
            return CodexResult(text=json.dumps(lesson), duration_ms=1)

    import app.services.pipeline.run as run_module

    monkeypatch.setattr(run_module, "CliCodexDriver", FakeDriver)

    with pytest.raises(CourseValidationError, match="failed lesson s02 is missing error"):
        await generate_course(
            str(repo),
            on_progress,
            Settings(R2L_DATA_DIR=tmp_path / "data", R2L_MOCK=False),
        )

    assert {
        "type": "validation",
        "round": 1,
        "passed": False,
        "issueCount": 1,
    } in events
    assert any(
        event.get("type") == "log" and "failed lesson s02 is missing error" in str(event.get("message"))
        for event in events
    )


def test_course_validation_catches_missing_lesson_body() -> None:
    from app.core.schemas import Course

    data = build_mock_course("https://github.com/chalk/chalk")
    del data["lessons"]["s02"]
    issues = validate_course_schema(Course.model_validate(data))
    assert issues == ["missing lesson bodies: s02"]


def test_mermaid_validation_catches_unquoted_sensitive_flowchart_labels() -> None:
    bad = "flowchart TD\n  A[OS 启动] --> B[main.main()]\n  B --> C[/api/generate]"
    good = 'flowchart TD\n  A["OS 启动"] --> B["main.main()"]\n  B --> C["/api/generate"]'

    assert any("quote it" in issue for issue in validate_mermaid_text(bad, "lesson.diagram"))
    assert validate_mermaid_text(good, "lesson.diagram") == []


def test_mermaid_validation_catches_unquoted_sensitive_edge_labels() -> None:
    bad = "flowchart TD\n  A -->|ToolCall[]| B"
    good = 'flowchart TD\n  A -->|"ToolCall[]"| B'

    assert any("edge label" in issue for issue in validate_mermaid_text(bad, "lesson.diagram"))
    assert validate_mermaid_text(good, "lesson.diagram") == []


def test_zh_course_validation_catches_mermaid_and_placeholder_quality() -> None:
    from app.core.schemas import ZhLesson, ZhOutline

    fixture = build_mock_course("https://github.com/chalk/chalk")
    outline = ZhOutline.model_validate(_zh_outline_from_fixture(fixture))
    lesson = _zh_lesson_from_fixture(fixture, "s01")
    lesson["diagram"]["diagram"] = "flowchart TD\n  A[入口] --> B[main.main()]"
    lesson["deepDive"] = "TODO"
    lessons = {"s01": ZhLesson.model_validate(lesson)}

    issues = validate_zh_course_schema(outline, lessons)

    assert any("Mermaid-sensitive" in issue for issue in issues)
    assert any("placeholder" in issue for issue in issues)


def test_course_alignment_warns_for_missing_repo_paths(tmp_path: Path) -> None:
    from app.core.schemas import Course
    from app.services.repo import RepoContext

    course = Course.model_validate(build_mock_course("https://github.com/chalk/chalk"))
    ctx = RepoContext(
        url="https://github.com/chalk/chalk",
        localPath=str(tmp_path),
        sha="abc123",
        name="chalk",
        defaultBranch="main",
        summary="",
        loc=0,
        languages={},
        tree=["README.md"],
    )
    issues = validate_course_alignment(course, ctx)
    assert any("keyFiles references missing path" in issue for issue in issues)


def test_zh_course_validation_catches_missing_body_and_bad_status() -> None:
    from app.core.schemas import ZhLesson, ZhOutline

    fixture = build_mock_course("https://github.com/chalk/chalk")
    outline = ZhOutline.model_validate(_zh_outline_from_fixture(fixture))
    lessons = {
        "s01": ZhLesson.model_validate(_zh_lesson_from_fixture(fixture, "s01")),
        "s02": ZhLesson.model_validate({**_zh_lesson_from_fixture(fixture, "s02"), "status": "failed"}),
    }

    issues = validate_zh_course_schema(outline, lessons)

    assert "failed lesson s02 is missing error" in issues


def test_zh_course_alignment_warns_for_missing_repo_paths(tmp_path: Path) -> None:
    from app.core.schemas import ZhLesson, ZhOutline
    from app.services.repo import RepoContext

    fixture = build_mock_course("https://github.com/chalk/chalk")
    outline = ZhOutline.model_validate(_zh_outline_from_fixture(fixture))
    lessons = {
        lesson_id: ZhLesson.model_validate(_zh_lesson_from_fixture(fixture, lesson_id))
        for lesson_id in ["s01", "s02"]
    }
    ctx = RepoContext(
        url="https://github.com/chalk/chalk",
        localPath=str(tmp_path),
        sha="abc123",
        name="chalk",
        defaultBranch="main",
        summary="",
        loc=0,
        languages={},
        tree=["README.md"],
    )

    issues = validate_zh_course_alignment(outline, lessons, ctx)

    assert any("filesToRead references missing path" in issue for issue in issues)


def test_zh_course_alignment_catches_fabricated_snippet(tmp_path: Path) -> None:
    from app.core.schemas import ZhLesson, ZhOutline
    from app.services.repo import RepoContext

    repo = tmp_path / "repo"
    repo.mkdir()
    write_fixture_repo_files(repo)
    fixture = build_mock_course("https://github.com/chalk/chalk")
    outline = ZhOutline.model_validate(_zh_outline_from_fixture(fixture))
    lesson_data = _zh_lesson_from_fixture(fixture, "s01")
    lesson_data["howItWorks"][0]["code"]["snippet"] = "const fabricatedValue = callSomethingThatDoesNotExist();"
    lesson_data["howItWorks"][0]["code"]["isSpine"] = False
    lessons = {"s01": ZhLesson.model_validate(lesson_data)}
    ctx = RepoContext(
        url="https://github.com/chalk/chalk",
        localPath=str(repo),
        sha="abc123",
        name="chalk",
        defaultBranch="main",
        summary="",
        loc=0,
        languages={},
        tree=[
            "README.md",
            "src/index.ts",
            "backend/app/api/generate.py",
            "backend/app/services/jobs.py",
            "site/lib/server/jobs.ts",
            "backend/app/services/store.py",
            "site/lib/server/store.ts",
        ],
    )

    issues = validate_zh_course_alignment(outline, lessons, ctx)

    assert any("code snippet does not match real file contents" in issue for issue in issues)
