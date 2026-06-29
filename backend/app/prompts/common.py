from __future__ import annotations

import json

from app.services.repo import RepoContext


def repo_context_block(ctx: RepoContext) -> str:
    tree = "\n".join(f"- {path}" for path in ctx.tree[:240])
    langs = json.dumps(ctx.languages, ensure_ascii=False, sort_keys=True)
    return f"""REPOSITORY
url: {ctx.url}
name: {ctx.name}
sha: {ctx.sha}
defaultBranch: {ctx.defaultBranch}
loc: {ctx.loc}
languages: {langs}

README SUMMARY
{ctx.summary or "(no README summary)"}

FILE TREE SAMPLE
{tree}
"""

