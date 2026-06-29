from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import Any

from app.core.config import Settings, get_settings
from app.core.schemas import Course, CourseMeta, JobRecord


def repo_id_for(url: str) -> str:
    base = re.split(r"[/\:]", url)
    name = next((part for part in reversed(base) if part), "repo")
    name = re.sub(r"\.git$", "", name)
    slug = re.sub(r"[^a-z0-9_-]+", "-", name, flags=re.IGNORECASE)[:40].lower()
    slug = re.sub(r"^-+|-+$", "", slug)
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:6]
    return f"{slug or 'repo'}-{digest}"


def dir_name_for_url(url: str) -> str:
    base = re.split(r"[/\:]", url)
    name = next((part for part in reversed(base) if part), "repo")
    name = re.sub(r"\.git$", "", name)
    return re.sub(r"[^a-z0-9_-]+", "-", name, flags=re.IGNORECASE)


def _settings(settings: Settings | None = None) -> Settings:
    return settings or get_settings()


def _dump_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def _read_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def save_course(
    repo_id: str,
    course: Course | dict[str, Any],
    meta: CourseMeta | dict[str, Any],
    settings: Settings | None = None,
) -> None:
    cfg = _settings(settings)
    course_data = course.model_dump(mode="json", exclude_none=True) if isinstance(course, Course) else course
    meta_data = meta.model_dump(mode="json", exclude_none=True) if isinstance(meta, CourseMeta) else meta
    target = cfg.courses_dir / repo_id
    target.mkdir(parents=True, exist_ok=True)
    (target / "course.json").write_text(_dump_json(course_data), encoding="utf-8")
    (target / "meta.json").write_text(_dump_json(meta_data), encoding="utf-8")


def get_course(repo_id: str, settings: Settings | None = None) -> Course | None:
    cfg = _settings(settings)
    data = _read_json(cfg.courses_dir / repo_id / "course.json")
    if data is None:
        return None
    return Course.model_validate(data)


def get_course_raw(repo_id: str, settings: Settings | None = None) -> dict[str, Any] | None:
    cfg = _settings(settings)
    data = _read_json(cfg.courses_dir / repo_id / "course.json")
    return data if isinstance(data, dict) else None


def get_meta(repo_id: str, settings: Settings | None = None) -> CourseMeta | None:
    cfg = _settings(settings)
    data = _read_json(cfg.courses_dir / repo_id / "meta.json")
    if data is None:
        return None
    return CourseMeta.model_validate(data)


def list_courses(settings: Settings | None = None) -> list[CourseMeta]:
    cfg = _settings(settings)
    try:
        dirs = [p for p in cfg.courses_dir.iterdir() if p.is_dir()]
    except OSError:
        return []

    metas: list[CourseMeta] = []
    for path in dirs:
        meta = get_meta(path.name, cfg)
        if meta is not None:
            metas.append(meta)
    return sorted(metas, key=lambda item: item.createdAt, reverse=True)


def remove_course(repo_id: str, settings: Settings | None = None) -> None:
    cfg = _settings(settings)
    shutil.rmtree(cfg.courses_dir / repo_id, ignore_errors=True)


def remove_repo_clone(repo_url: str, settings: Settings | None = None) -> None:
    cfg = _settings(settings)
    shutil.rmtree(cfg.work_dir / dir_name_for_url(repo_url), ignore_errors=True)


def save_job_record(record: JobRecord | dict[str, Any], settings: Settings | None = None) -> None:
    cfg = _settings(settings)
    cfg.jobs_dir.mkdir(parents=True, exist_ok=True)
    data = record.model_dump(mode="json", exclude_none=True) if isinstance(record, JobRecord) else record
    (cfg.jobs_dir / f"{data['id']}.json").write_text(_dump_json(data), encoding="utf-8")


def get_job_record(job_id: str, settings: Settings | None = None) -> JobRecord | None:
    cfg = _settings(settings)
    data = _read_json(cfg.jobs_dir / f"{job_id}.json")
    if data is None:
        return None
    return JobRecord.model_validate(data)


def remove_job_record(job_id: str, settings: Settings | None = None) -> None:
    cfg = _settings(settings)
    try:
        (cfg.jobs_dir / f"{job_id}.json").unlink()
    except FileNotFoundError:
        return
    except OSError:
        return


def list_job_records(settings: Settings | None = None) -> list[JobRecord]:
    cfg = _settings(settings)
    try:
        files = [p for p in cfg.jobs_dir.iterdir() if p.is_file() and p.suffix == ".json"]
    except OSError:
        return []

    records: list[JobRecord] = []
    for path in files:
        data = _read_json(path)
        if data is None:
            continue
        try:
            records.append(JobRecord.model_validate(data))
        except ValueError:
            continue
    return sorted(records, key=lambda item: item.startedAt, reverse=True)

