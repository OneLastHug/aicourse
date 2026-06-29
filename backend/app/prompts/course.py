from __future__ import annotations

import json

from app.prompts.common import repo_context_block
from app.services.repo import RepoContext


def course_prompt(ctx: RepoContext, analysis: dict, target_lessons: int = 8) -> str:
    analysis_json = json.dumps(analysis, ensure_ascii=False, indent=2)
    return f"""You are building an interactive bilingual course for a codebase.

Read the actual repository files in your current working directory. Generate a
complete Course JSON object compatible with the Repo2Learn frontend. The output
must be valid JSON and must include both Chinese and English for every user-facing
text field.

{repo_context_block(ctx)}

ANALYSIS
{analysis_json}

COURSE DESIGN RULES
- Create about {target_lessons} lessons, ordered from beginner to advanced.
- Use section groups. Each lesson teaches exactly one mechanism.
- All keyFiles must be real repository paths.
- Use concise learn-by-reading style: problem -> mechanism -> steps -> source comparison.
- Code snippets must come from real repository files when possible. Keep snippets short.
- If you cannot safely quote a file, use a small teaching snippet and mark it as spine.
- The final JSON must already be bilingual: {{ "zh": "...", "en": "..." }}.

Return STRICT JSON ONLY with this exact top-level shape:
{{
  "outline": {{
    "course": {{
      "title": {{"zh": "...", "en": "..."}},
      "tagline": {{"zh": "...", "en": "..."}},
      "repo": {{"url": "{ctx.url}", "name": "{ctx.name}", "sha": "{ctx.sha}"}},
      "spine": {{"zh": "...", "en": "..."}},
      "thesis": {{"zh": "...", "en": "..."}},
      "audience": {{"zh": "...", "en": "..."}},
      "whyThisOrder": {{"zh": "...", "en": "..."}}
    }},
    "archDiagram": {{
      "kind": "mermaid",
      "caption": {{"zh": "...", "en": "..."}},
      "diagram": "flowchart TD..."
    }},
    "sections": [
      {{
        "id": "l01",
        "title": {{"zh": "...", "en": "..."}},
        "summary": {{"zh": "...", "en": "..."}},
        "spine": {{"zh": "...", "en": "..."}},
        "role": {{"zh": "...", "en": "..."}},
        "transitionIn": {{"zh": "...", "en": "..."}},
        "transitionOut": {{"zh": "...", "en": "..."}},
        "lessons": [
          {{
            "id": "s01",
            "title": {{"zh": "...", "en": "..."}},
            "difficulty": "beginner",
            "theProblem": {{"zh": "...", "en": "..."}},
            "objective": {{"zh": "...", "en": "..."}},
            "mechanism": {{"zh": "...", "en": "..."}},
            "whyNow": {{"zh": "...", "en": "..."}},
            "missingBefore": {{"zh": "...", "en": "..."}},
            "nextPressure": {{"zh": "...", "en": "..."}},
            "keyFiles": ["real/path"],
            "prereq": [],
            "tags": ["tag"]
          }}
        ]
      }}
    ],
    "lessons": [
      "same flattened lesson objects used inside sections"
    ]
  }},
  "lessons": {{
    "s01": {{
      "id": "s01",
      "principle": {{"zh": "...", "en": "..."}},
      "teachingScope": {{"zh": "...", "en": "..."}},
      "problem": {{"zh": "...", "en": "..."}},
      "solution": {{"zh": "...", "en": "..."}},
      "diagram": {{
        "kind": "mermaid",
        "caption": {{"zh": "...", "en": "..."}},
        "diagram": "flowchart TD..."
      }},
      "spine": {{
        "lessonId": "s01",
        "path": "s01/code.py",
        "language": "py",
        "code": "short runnable teaching code or source excerpt",
        "runCmd": "optional command",
        "addedLines": []
      }},
      "howItWorks": [
        {{
          "title": {{"zh": "...", "en": "..."}},
          "desc": {{"zh": "...", "en": "..."}},
          "code": {{
            "file": "real/path/or/spine/path",
            "language": "ts",
            "snippet": "short code snippet",
            "highlightLines": [1],
            "isSpine": false,
            "symbol": "optional"
          }},
          "anatomy": {{"zh": "...", "en": "..."}}
        }}
      ],
      "deepDive": {{"zh": "markdown", "en": "markdown"}},
      "deepSource": {{"zh": "markdown", "en": "markdown"}},
      "sourceCompare": {{
        "simplified": {{"zh": "...", "en": "..."}},
        "real": {{"zh": "...", "en": "..."}},
        "gaps": [
          {{
            "dimension": {{"zh": "...", "en": "..."}},
            "simplified": {{"zh": "...", "en": "..."}},
            "real": {{"zh": "...", "en": "..."}},
            "whySimplified": {{"zh": "...", "en": "..."}}
          }}
        ]
      }},
      "tryIt": {{
        "setup": [{{"zh": "...", "en": "..."}}],
        "commands": [{{"zh": "...", "en": "..."}}],
        "observe": [{{"zh": "...", "en": "..."}}]
      }},
      "whatsNext": {{"zh": "...", "en": "..."}},
      "references": [],
      "compare": {{
        "rows": [
          {{"label": {{"zh": "...", "en": "..."}}, "a": "...", "b": "..."}}
        ]
      }},
      "loc": 10,
      "badges": {{"loc": 10, "difficulty": "beginner", "concepts": ["concept"]}},
      "status": "ok"
    }}
  }}
}}

Important:
- `outline.lessons` must be an array of real lesson objects, not strings.
- `lessons` must contain one full lesson object for every outline lesson id.
- Omit fields only if optional. Required arrays may be empty.
- Return JSON only.
"""

