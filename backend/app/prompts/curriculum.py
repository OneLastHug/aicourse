from __future__ import annotations

import json
from typing import Any

from app.prompts.common import repo_context_block
from app.services.repo import RepoContext


def curriculum_prompt(ctx: RepoContext, analysis: dict[str, Any], target_lessons: int = 8) -> str:
    analysis_json = json.dumps(analysis, ensure_ascii=False, indent=2)
    return f"""你是课程架构师。把仓库分析转成一套中文优先的分层教程大纲。

请在需要时读取真实文件；下面的仓库上下文和分析结果是你的地图。

{repo_context_block(ctx)}

ANALYSIS
{analysis_json}

设计规则：
- 总课时约 {target_lessons} 节，按 beginner -> advanced 递进。
- 课程分成 3-5 个 section，每层一个连贯主题。
- 每节只讲一个机制，并推动读者沿真实执行路径理解仓库。
- filesToRead 必须是真实仓库路径，不能编造路径。
- prereq 只能引用更早的 lesson id。
- 面向用户的文本全部使用简体中文；id、difficulty、repo、paths 保持原样。
- 标题短、机制明确，不要用整句当标题。
- 中英混排要自然：开发者口头常用英文术语如 token、API、CLI、SDK、payload、agent 可保留英文。

返回 STRICT JSON ONLY，匹配这个 ZhOutline 形状：
{{
  "course": {{
    "title": "...",
    "tagline": "...",
    "repo": {{"url": "{ctx.url}", "name": "{ctx.name}", "sha": "{ctx.sha}"}},
    "spine": "...",
    "thesis": "...",
    "audience": "...",
    "whyThisOrder": "..."
  }},
  "archDiagram": {{
    "kind": "mermaid",
    "caption": "...",
    "diagram": "flowchart TD..."
  }},
  "sections": [
    {{
      "id": "l01",
      "title": "...",
      "summary": "...",
      "spine": "...",
      "role": "...",
      "transitionIn": "...",
      "transitionOut": "...",
      "lessons": [
        {{
          "id": "s01",
          "title": "...",
          "difficulty": "beginner",
          "theProblem": "...",
          "objective": "...",
          "mechanism": "...",
          "whyNow": "...",
          "missingBefore": "...",
          "nextPressure": "...",
          "filesToRead": ["real/path"],
          "prereq": [],
          "tags": ["tag"]
        }}
      ]
    }}
  ],
  "lessons": [
    "the same flattened lesson objects from all sections, in reading order"
  ]
}}

重要：
- 顶层可以省略 `lessons`；后端会从 sections 展平生成。
- 如果返回了顶层 `lessons`，它必须是真实 lesson 对象数组，不能是字符串。
- section lesson arrays 和顶层 lessons 必须使用同一批 id。
- 只返回 JSON，不要 markdown fence 或解释文字。
"""
