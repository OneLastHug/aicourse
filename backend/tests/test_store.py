from __future__ import annotations

from pathlib import Path

from app.core.config import Settings
from app.sample.fixtures import build_mock_course
from app.services.store import get_course, get_meta, repo_id_for, save_course


def settings_for(tmp_path: Path) -> Settings:
    return Settings(R2L_DATA_DIR=tmp_path, R2L_MOCK=True)


def test_repo_id_for_matches_typescript_rule() -> None:
    assert repo_id_for("https://github.com/chalk/chalk") == "chalk-65b538"
    assert repo_id_for("https://github.com/owner/repo.git") == "repo-240879"
    assert repo_id_for("git@github.com:owner/my.repo.git") == "my-repo-8a0760"


def test_save_and_read_course(tmp_path: Path) -> None:
    settings = settings_for(tmp_path)
    repo_url = "https://github.com/chalk/chalk"
    repo_id = repo_id_for(repo_url)
    course = build_mock_course(repo_url)
    meta = {
        "repoId": repo_id,
        "url": repo_url,
        "name": "chalk",
        "title": "chalk Code Reading Course",
        "createdAt": "2026-06-29T00:00:00.000Z",
        "lessonCount": 2,
    }

    save_course(repo_id, course, meta, settings)

    loaded = get_course(repo_id, settings)
    loaded_meta = get_meta(repo_id, settings)
    assert loaded is not None
    assert loaded.outline.course.repo.name == "chalk"
    assert loaded.lessons["s01"].status == "ok"
    assert loaded_meta is not None
    assert loaded_meta.repoId == repo_id
