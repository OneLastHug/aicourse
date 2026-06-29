from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Literal

from pydantic import Field

from app.core.config import Settings, get_settings
from app.core.schemas import ApiModel
from app.services.codex_driver import CliCodexDriver, CodexCall
from app.services.json_parse import JsonExtractionError, parse_model

AssistantMode = Literal["explain", "translate", "example", "followup", "summarize", "quiz"]


class AssistantTurn(ApiModel):
    role: Literal["user", "assistant"]
    content: str


class AssistantContext(ApiModel):
    repoId: str | None = None
    locale: Literal["zh", "en"] = "zh"
    courseTitle: str | None = None
    lessonId: str | None = None
    lessonTitle: str | None = None
    sectionTitle: str | None = None
    selectionText: str = ""
    selectionKind: str = "text"
    surroundingText: str | None = None
    codeFile: str | None = None
    codeLanguage: str | None = None
    activeStep: str | None = None


class AssistantRequest(ApiModel):
    question: str = ""
    mode: AssistantMode = "explain"
    context: AssistantContext = Field(default_factory=AssistantContext)
    history: list[AssistantTurn] = Field(default_factory=list)


class AssistantReference(ApiModel):
    label: str
    href: str | None = None


class AssistantResponse(ApiModel):
    answer: str
    summary: str
    highlights: list[str] = Field(default_factory=list)
    followUps: list[str] = Field(default_factory=list)
    references: list[AssistantReference] = Field(default_factory=list)
    provider: str = "local"


async def answer_question(
    request: AssistantRequest,
    settings: Settings | None = None,
) -> AssistantResponse:
    cfg = settings or get_settings()
    provider = _assistant_provider(cfg)
    if provider == "mock":
        return _local_teacher_answer(request, "local")
    if provider == "openai":
        try:
            return await _answer_with_openai_compatible(request, cfg)
        except Exception:
            return _local_teacher_answer(request, "local")
    try:
        return await _answer_with_codex(request, cfg)
    except Exception:
        return _local_teacher_answer(request, "local")


def _assistant_provider(cfg: Settings) -> Literal["mock", "openai", "codex"]:
    configured = cfg.r2l_assistant_provider
    if cfg.r2l_mock or configured == "mock":
        return "mock"
    if configured == "openai" or cfg.r2l_assistant_base_url:
        return "openai"
    return "codex"


async def _answer_with_codex(request: AssistantRequest, cfg: Settings) -> AssistantResponse:
    prompt = _teacher_prompt(request)
    result = await CliCodexDriver(cfg).run(
        CodexCall(
            label="codex-sidebar-teacher",
            prompt=prompt,
            cwd=Path.cwd(),
        )
    )
    parsed = parse_model(AssistantResponse, result.text)
    parsed.provider = "codex"
    return parsed


async def _answer_with_openai_compatible(
    request: AssistantRequest,
    cfg: Settings,
) -> AssistantResponse:
    prompt = _teacher_prompt(request)
    content = await asyncio.to_thread(_post_openai_compatible, prompt, cfg)
    try:
        parsed = parse_model(AssistantResponse, content)
    except JsonExtractionError:
        parsed = AssistantResponse(
            answer=content.strip(),
            summary=_clip(content.strip(), 80),
            highlights=[],
            followUps=_default_followups(request),
            provider="openai-compatible",
        )
    parsed.provider = "openai-compatible"
    return parsed


def _post_openai_compatible(prompt: str, cfg: Settings) -> str:
    if not cfg.r2l_assistant_base_url:
        raise RuntimeError("R2L_ASSISTANT_BASE_URL is not configured")
    url = _chat_completions_url(cfg.r2l_assistant_base_url)
    payload = {
        "model": cfg.r2l_assistant_model or cfg.r2l_codex_model,
        "messages": [
            {
                "role": "system",
                "content": "你是 AICourse 的中文 AI 教师。回答必须稳定、准确、面向学习者。",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    headers = {"content-type": "application/json"}
    if cfg.r2l_assistant_api_key:
        headers["authorization"] = f"Bearer {cfg.r2l_assistant_api_key}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=cfg.r2l_assistant_timeout_ms / 1000) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[-500:]
        raise RuntimeError(f"assistant provider returned {exc.code}: {body}") from exc
    return str(data["choices"][0]["message"]["content"])


def _chat_completions_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1"):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"


def _teacher_prompt(request: AssistantRequest) -> str:
    ctx = request.context
    mode_instruction = {
        "explain": "解释选中内容：先讲结论，再讲机制，再给一个小例子。",
        "translate": "把选中内容翻译成更容易懂的中文白话；如果原文已经是中文，就改写成更通俗的讲法。",
        "example": "围绕选中内容给一个短小、具体、贴近代码学习的例子。",
        "followup": "回答用户追问，保持和当前课程上下文一致。",
        "summarize": "总结当前 lesson 的核心知识点，并指出最容易卡住的地方。",
        "quiz": "基于选中内容出一道小练习，并给出参考答案。",
    }[request.mode]

    history = "\n".join(
        f"{turn.role}: {_clip(turn.content, 700)}" for turn in request.history[-8:]
    ) or "(no previous turns)"

    return f"""你是 AICourse 的中文 AI 教师，正在辅导一个国内学习者阅读项目课程。

教学要求：
- 默认用中文回答，除非用户明确要求英文。
- 不要闲聊；像老师一样先把概念讲清楚。
- 不要编造当前仓库、文件或代码里没有的事实。
- 如果上下文不足，明确说明需要更多上下文，并给出你能确定的部分。
- 回答不要太长，适合放在右侧学习侧边栏里。
- 必须返回严格 JSON，不要 markdown 代码围栏，不要 JSON 之外的文字。

本次任务：{mode_instruction}

当前课程上下文：
- courseTitle: {_clip(ctx.courseTitle or "", 160)}
- repoId: {_clip(ctx.repoId or "", 80)}
- lessonId: {_clip(ctx.lessonId or "", 80)}
- lessonTitle: {_clip(ctx.lessonTitle or "", 160)}
- sectionTitle: {_clip(ctx.sectionTitle or "", 120)}
- selectionKind: {_clip(ctx.selectionKind or "text", 40)}
- codeFile: {_clip(ctx.codeFile or "", 160)}
- codeLanguage: {_clip(ctx.codeLanguage or "", 60)}
- activeStep: {_clip(ctx.activeStep or "", 120)}

用户选中的内容：
{_clip(ctx.selectionText, 2400) or "(no selected text)"}

选区附近上下文：
{_clip(ctx.surroundingText or "", 2400) or "(no surrounding text)"}

用户问题：
{_clip(request.question, 1200) or "(user clicked a quick action)"}

最近对话：
{history}

返回 JSON 结构必须完全兼容：
{{
  "answer": "用中文分段解释，建议包含：先说结论、为什么、例子、下一步。",
  "summary": "一句话总结",
  "highlights": ["关键点1", "关键点2", "关键点3"],
  "followUps": ["可以继续问的问题1", "可以继续问的问题2"],
  "references": [{{"label": "当前 lesson", "href": null}}]
}}
"""


def _local_teacher_answer(request: AssistantRequest, provider: str) -> AssistantResponse:
    ctx = request.context
    selected = _clip(ctx.selectionText.strip(), 360)
    target = selected or _clip(ctx.lessonTitle or ctx.courseTitle or "当前内容", 120)
    location = "当前课程"
    if ctx.lessonId or ctx.lessonTitle:
        location = f"{ctx.lessonId or ''} {ctx.lessonTitle or ''}".strip()
    kind = "代码" if ctx.selectionKind == "code" else "这段内容"

    if request.mode == "translate":
        answer = (
            f"先说结论：{kind}可以理解为「{target}」。\n\n"
            f"白话解释：它出现在 {location} 里，作用是帮助你把抽象概念落到一个具体机制上。"
            "如果你想彻底吃透它，下一步应该追问它和本节目标之间的关系。"
        )
    elif request.mode == "example":
        answer = (
            f"先说结论：{target} 的关键是先抓住它解决的问题。\n\n"
            "举个例子：如果课程在讲 agent 循环，那么一行看似普通的判断语句，"
            "往往是在决定模型是继续调用工具，还是结束这一轮任务。\n\n"
            "下一步：你可以继续问我“这段在真实项目里会怎么写”。"
        )
    elif request.mode == "quiz":
        answer = (
            f"小练习：请用一句话说明 {target} 在本节中的作用。\n\n"
            "参考答案：它把一个抽象机制落到可观察的行为上，让你能判断系统为什么会这样运行。"
        )
    elif request.mode == "summarize":
        answer = (
            f"先说结论：{location or '这一节'} 的核心不是记住所有细节，而是抓住它新增的那个机制。\n\n"
            "学习时建议按三步看：它解决什么问题、它怎么工作、它和真实源码有什么差别。"
        )
    else:
        answer = (
            f"先说结论：{target} 是 {location} 中需要重点理解的学习点。\n\n"
            f"为什么：它不是孤立的一句话，而是在当前 lesson 里承担解释机制的作用。"
            "你应该把它和本节的问题、解决方案、代码步骤放在一起看。\n\n"
            "例子：如果选中的是代码，就先问它的输入、输出和副作用；如果选中的是概念，"
            "就先问它解决了什么问题。\n\n"
            "下一步：可以继续让我从初学者角度重讲一遍，或结合真实源码解释。"
        )

    return AssistantResponse(
        answer=answer,
        summary=_clip(target, 80),
        highlights=[
            "先定位它在本节里的作用",
            "再看它解决的问题",
            "最后和代码或源码对照",
        ],
        followUps=_default_followups(request),
        references=[AssistantReference(label=location or "当前 lesson")],
        provider=provider,
    )


def _default_followups(request: AssistantRequest) -> list[str]:
    if request.context.selectionKind == "code":
        return ["逐行解释这段代码", "真实项目里为什么要这样写？", "给一个更小的例子"]
    return ["用更白话的方式再讲一遍", "给一个具体例子", "这和本节目标有什么关系？"]


def _clip(value: str, limit: int) -> str:
    text = value.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"

