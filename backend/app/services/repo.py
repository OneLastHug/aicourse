from __future__ import annotations

import asyncio
from pathlib import Path

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.services.store import dir_name_for_url

IGNORED_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    ".next",
    "target",
    ".repo2learn",
    "coverage",
    ".turbo",
    ".cache",
    "vendor",
    ".venv",
    "venv",
}

CODE_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".rb",
    ".c",
    ".h",
    ".cpp",
    ".cs",
    ".swift",
}


class RepoContext(BaseModel):
    url: str
    localPath: str
    sha: str
    name: str
    defaultBranch: str
    summary: str
    loc: int
    languages: dict[str, float]
    tree: list[str]


async def ingest_repo(repo: str, settings: Settings | None = None) -> RepoContext:
    cfg = settings or get_settings()
    is_url = repo.startswith(("http://", "https://", "git@"))
    local_path = await _clone_or_pull(repo, cfg.work_dir) if is_url else Path(repo)
    if not local_path.is_dir():
        raise FileNotFoundError(f"repo path not found or not a directory: {repo}")

    tree = _collect_tree(local_path)
    languages, loc = _analyze(local_path, tree)
    return RepoContext(
        url=repo,
        localPath=str(local_path),
        sha=await _git(["rev-parse", "--short", "HEAD"], local_path, fallback="unknown"),
        name=_derive_name(repo, local_path),
        defaultBranch=await _git(
            ["rev-parse", "--abbrev-ref", "HEAD"],
            local_path,
            fallback="main",
        ),
        summary=_read_readme(local_path),
        loc=loc,
        languages=languages,
        tree=tree,
    )


async def _clone_or_pull(url: str, work_dir: Path) -> Path:
    work_dir.mkdir(parents=True, exist_ok=True)
    target = work_dir / dir_name_for_url(url)
    if (target / ".git").exists():
        await _git(["pull", "--ff-only"], target)
        return target
    await _git(["clone", "--depth", "1", url, str(target)], work_dir)
    return target


async def _git(args: list[str], cwd: Path, fallback: str | None = None) -> str:
    proc = await asyncio.create_subprocess_exec(
        "git",
        *args,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode == 0:
        return stdout.decode("utf-8", errors="replace").strip()
    if fallback is not None:
        return fallback
    raise RuntimeError(stderr.decode("utf-8", errors="replace")[-800:])


def _collect_tree(root: Path) -> list[str]:
    out: list[str] = []
    for path in root.rglob("*"):
        rel_parts = path.relative_to(root).parts
        if any(part in IGNORED_DIRS for part in rel_parts):
            continue
        if path.is_file():
            out.append(path.relative_to(root).as_posix())
    return sorted(out)


def _analyze(root: Path, tree: list[str]) -> tuple[dict[str, float], int]:
    bytes_by_lang: dict[str, int] = {}
    loc = 0
    for rel in tree:
        path = root / rel
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        except OSError:
            continue
        lang = _language_of(path)
        bytes_by_lang[lang] = bytes_by_lang.get(lang, 0) + len(content)
        if path.suffix.lower() in CODE_EXTENSIONS:
            loc += sum(1 for line in content.splitlines() if line.strip())

    total = sum(bytes_by_lang.values()) or 1
    return {lang: round(size / total, 3) for lang, size in bytes_by_lang.items()}, loc


def _language_of(path: Path) -> str:
    return {
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".mjs": "JavaScript",
        ".cjs": "JavaScript",
        ".py": "Python",
        ".go": "Go",
        ".rs": "Rust",
        ".java": "Java",
        ".kt": "Kotlin",
        ".rb": "Ruby",
        ".php": "PHP",
        ".c": "C",
        ".h": "C",
        ".cpp": "C++",
        ".cs": "C#",
        ".swift": "Swift",
        ".md": "Markdown",
        ".mdx": "MDX",
        ".css": "CSS",
        ".scss": "SCSS",
        ".html": "HTML",
        ".json": "JSON",
        ".yml": "YAML",
        ".yaml": "YAML",
        ".toml": "TOML",
        ".sh": "Shell",
    }.get(path.suffix.lower(), "Other")


def _read_readme(root: Path) -> str:
    for name in ["README.md", "readme.md", "README.MD", "README"]:
        try:
            return " ".join((root / name).read_text(encoding="utf-8").split())[:800]
        except OSError:
            continue
    return ""


def _derive_name(repo: str, local_path: Path) -> str:
    base = repo.replace("\\", "/").rstrip("/").split("/")[-1] or local_path.name
    return base.removesuffix(".git")

