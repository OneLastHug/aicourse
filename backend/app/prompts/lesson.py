from __future__ import annotations

import json

from app.core.schemas import ZhOutline, ZhOutlineLesson
from app.prompts.common import repo_context_block
from app.services.repo import RepoContext


def lesson_prompt(ctx: RepoContext, outline: ZhOutline, lesson: ZhOutlineLesson) -> str:
    outline_brief = {
        "course": outline.course.model_dump(mode="json", exclude_none=True),
        "lessons": [
            {
                "id": item.id,
                "title": item.title,
                "difficulty": item.difficulty,
                "prereq": item.prereq,
            }
            for item in outline.lessons
        ],
    }
    lesson_json = json.dumps(lesson.model_dump(mode="json", exclude_none=True), ensure_ascii=False, indent=2)
    outline_json = json.dumps(outline_brief, ensure_ascii=False, indent=2)
    return f"""你正在为中文优先的代码阅读课程写一节课的正文。

写作前必须读取本节列出的真实仓库文件。尽量使用真实文件里的短代码片段；
如果为了教学需要写简化代码，把片段标记为 `isSpine: true`。

{repo_context_block(ctx)}

COURSE BRIEF
{outline_json}

LESSON META
{lesson_json}

返回 STRICT JSON ONLY，匹配这个 ZhLesson 形状。除标题类字段外，面向用户的正文文本全部使用简体中文；
code、文件路径、id、language、highlightLines、diagram.diagram、spine、URL、badges.concepts 保持原样：
{{
  "id": "{lesson.id}",
  "principle": "...",
  "teachingScope": "...",
  "problem": "...",
  "solution": "...",
  "diagram": {{
    "kind": "mermaid",
    "caption": "...",
    "diagram": "flowchart TD\\n  A[\\"入口 main()\\"] --> B[\\"cmd.NewCLI()\\"]"
  }},
  "spine": {{
    "lessonId": "{lesson.id}",
    "path": "{lesson.id}/code.py",
    "language": "py",
    "code": "short runnable teaching code or source excerpt",
    "runCmd": "optional command",
    "addedLines": []
  }},
  "howItWorks": [
    {{
      "title": "...",
      "desc": "...",
      "code": {{
        "file": "real/path/or/spine/path",
        "language": "ts",
        "snippet": "short code snippet",
        "highlightLines": [1],
        "isSpine": false,
        "symbol": "optional"
      }},
      "anatomy": "..."
    }}
  ],
  "deepDive": "markdown",
  "deepSource": "markdown",
  "sourceCompare": {{
    "simplified": "...",
    "real": "...",
    "gaps": [
      {{
        "dimension": "...",
        "simplified": "...",
        "real": "...",
        "whySimplified": "..."
      }}
    ]
  }},
  "tryIt": {{
    "setup": ["..."],
    "commands": ["..."],
    "observe": ["..."]
  }},
  "whatsNext": "...",
  "references": [{{"title":"...","url":"https://...","kind":"official","whyUsed":"..."}}],
  "compare": {{
    "rows": [
      {{"label": "...", "a": "...", "b": "..."}}
    ]
  }},
  "loc": 10,
  "badges": {{"loc": 10, "difficulty": "{lesson.difficulty}", "concepts": ["concept"]}},
  "filesUsed": ["real/path"],
  "status": "ok"
}}

写作规则：
- 顶层 id 必须是 "{lesson.id}"。
- 每节只讲一个机制，不重复其它节，但要像一篇短技术博客：通俗、顺滑、有上下文，不要为了短而把因果关系砍掉。
- 标题类字段一律使用英文，即使这是中文版本：howItWorks[].title 必须是英文；references[].title 保留官方英文标题或页面原题，不要翻译成中文。
- 英文标题要短但可懂：不要一个孤零零的抽象词，也不要整句口号。常见范围是 2-6 个英文词，例如 "Parse Request"、"Create Job"、"Apply Writes"。
- problem 要说清具体场景和痛点；solution 用 1-2 句点破思路，不要压成谜语。
- howItWorks 需要 4-8 步；每一步标题用英文，desc 用自然中文解释这一步做什么、为什么在这里做、拿掉会怎样。desc 不要只有短语。
- deepDive 讲设计取舍、边界和坑；deepSource 像技术博客带读者回到真实源码，说明该看哪段、为什么这段能证明本节结论。
- tryIt.commands 是可执行命令或可复现实验，observe 是读者应该观察的现象。
- filesUsed 必须列出本节实际使用的真实仓库路径。
- 代码片段必须足够短，适合 UI 展示。
- Mermaid 必须能被 Mermaid 11 解析。flowchart 的所有节点 label 一律用双引号：写 A["main.main()"]，不要写 A[main.main()]；包含 /、()、[]、*、@、路径、函数名、中文标点的 label 必须加引号。边标签也保持简短。
- 只返回 JSON，不要 markdown fence 或解释文字。
"""
