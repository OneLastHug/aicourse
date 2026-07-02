from __future__ import annotations

from app.prompts.common import repo_context_block
from app.services.repo import RepoContext


def analyze_prompt(ctx: RepoContext) -> str:
    return f"""You are a senior codebase reader.

Read the actual repository files in your current working directory. Use the
repository context below only as a map; inspect real files before answering.

{repo_context_block(ctx)}

Return STRICT JSON ONLY:
{{
  "summary": "one paragraph summary",
  "entrypoints": ["real/path"],
  "coreFlows": [
    {{
      "name": "short flow name",
      "steps": ["step 1", "step 2"],
      "files": ["real/path"]
    }}
  ],
  "teachingSpine": "one sentence describing the learning path",
  "risks": ["things the course must not misrepresent"],
  "archDiagram": {{
    "kind": "mermaid",
    "caption": "short architecture caption",
    "diagram": "flowchart TD\\n  A[\\"entry main()\\"] --> B[\\"router /api/*\\"]"
  }}
}}

Mermaid rules:
- Prefer flowchart TD for archDiagram.
- Every flowchart node label must be double-quoted, e.g. A["cmd.NewCLI()"], not A[cmd.NewCLI()].
- Quote labels containing /, (), [], *, @, file paths, function calls, or Chinese punctuation.
- Keep labels short enough to render; use multiple nodes instead of one long sentence.
"""
