from __future__ import annotations

import json

from app.core.schemas import ZhLesson, ZhOutline, ZhOutlineLesson
from app.prompts.common import repo_context_block
from app.services.pipeline.repair_types import RepairIssue
from app.services.repo import RepoContext


def lesson_repair_prompt(
    ctx: RepoContext,
    outline: ZhOutline,
    outline_lesson: ZhOutlineLesson,
    lesson: ZhLesson,
    issues: list[RepairIssue],
    *,
    round_no: int,
) -> str:
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
    payload = {
        "round": round_no,
        "lessonMeta": outline_lesson.model_dump(mode="json", exclude_none=True),
        "currentLesson": lesson.model_dump(mode="json", exclude_none=True),
        "issues": [issue.model_dump(mode="json", exclude_none=True) for issue in issues],
    }
    return f"""你正在修复一节已经生成出来的中文课程 lesson。不要重写整门课，只修指定 lesson。

必须读取真实仓库文件来修复文件路径和代码片段问题。若某个 code snippet 不能逐字来自真实文件，
要么改成真实文件里的短片段，要么标记为 `isSpine: true` 并把 file 指向本节 spine path。

{repo_context_block(ctx)}

COURSE BRIEF
{json.dumps(outline_brief, ensure_ascii=False, indent=2)}

REPAIR PAYLOAD
{json.dumps(payload, ensure_ascii=False, indent=2)}

返回 STRICT JSON ONLY，必须是完整 ZhLesson JSON，且满足：
- 顶层 id 必须保持为 "{lesson.id}"。
- 不要修改其它 lesson，不要返回 outline，不要返回解释文字。
- 尽量保持本节 title、教学目标和机制不变，只修 issues 指出的字段。
- round=1 的问题通常是 schema、Mermaid、标题语言、正文质量或交互规格问题。
- round=2 的问题通常是 filesUsed、filesToRead、code.file、code.snippet 与真实仓库不对齐。
- 如果 issue 指出 snippet mismatch，必须让对应 snippet 逐字存在于 code.file 中；否则把 code block 改为教学片段并设置 isSpine=true。
- Mermaid flowchart 的节点 label 一律用双引号，例如 A["main.main()"]。
- references.kind 只能是 official、spec、paper、blog、other。
- howItWorks 保持 4-8 步；filesUsed 必须只列真实仓库路径。
"""
