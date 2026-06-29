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
    "diagram": "flowchart TD..."
  }}
}}
"""

