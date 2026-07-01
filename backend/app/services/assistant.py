from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Literal

import httpx
from pydantic import Field

from app.core.config import Settings, get_settings
from app.core.schemas import ApiModel
from app.services.json_parse import JsonExtractionError, parse_model

AssistantMode = Literal["explain", "translate", "example", "followup", "summarize", "quiz"]

SIDEBAR_THREAD_LIMIT = 3
_sidebar_executor = ThreadPoolExecutor(
    max_workers=SIDEBAR_THREAD_LIMIT,
    thread_name_prefix="codex-sidebar",
)


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
    if cfg.r2l_assistant_mock or not cfg.r2l_assistant_endpoint:
        return _local_teacher_answer(request, "local")
    try:
        return await _answer_with_sidebar_provider(request, cfg)
    except Exception:
        return _local_teacher_answer(request, "local")


async def _answer_with_sidebar_provider(
    request: AssistantRequest,
    cfg: Settings,
) -> AssistantResponse:
    prompt = _teacher_prompt(request)
    loop = asyncio.get_running_loop()
    content = await loop.run_in_executor(_sidebar_executor, _post_sidebar_provider, prompt, cfg)
    parsed = _parse_assistant_response(content, request)
    parsed.provider = "codex-sidebar"
    return parsed


def _parse_assistant_response(content: str, request: AssistantRequest) -> AssistantResponse:
    text = content.strip()
    candidates = [text]
    unwrapped = _unwrap_json_string(text)
    if unwrapped and unwrapped not in candidates:
        candidates.append(unwrapped)

    for candidate in candidates:
        try:
            return _unwrap_nested_answer(parse_model(AssistantResponse, candidate))
        except (JsonExtractionError, ValueError):
            continue

    return AssistantResponse(
        answer=text,
        summary=_clip(text, 80),
        highlights=[],
        followUps=_default_followups(request),
        provider="codex-sidebar",
    )


def _unwrap_nested_answer(response: AssistantResponse) -> AssistantResponse:
    current = response
    for _ in range(3):
        answer = _unwrap_json_string(current.answer.strip())
        if not answer:
            return current
        try:
            nested = parse_model(AssistantResponse, answer)
        except (JsonExtractionError, ValueError):
            return current
        current = nested
    return current


def _unwrap_json_string(text: str) -> str:
    current = text.strip()
    for _ in range(3):
        try:
            value = json.loads(current)
        except json.JSONDecodeError:
            return current
        if isinstance(value, str):
            current = value.strip()
            continue
        if isinstance(value, dict | list):
            return json.dumps(value, ensure_ascii=False)
        return current
    return current


def _post_sidebar_provider(prompt: str, cfg: Settings) -> str:
    if not cfg.r2l_assistant_endpoint:
        raise RuntimeError("R2L_ASSISTANT_ENDPOINT is not configured")
    url, payload = _sidebar_provider_request(cfg, prompt)
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
        if _is_responses_endpoint(cfg.r2l_assistant_endpoint):
            with httpx.Client(timeout=cfg.r2l_assistant_timeout_ms / 1000) as client:
                res = client.post(url, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
        else:
            with urllib.request.urlopen(req, timeout=cfg.r2l_assistant_timeout_ms / 1000) as res:
                data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[-500:]
        raise RuntimeError(f"assistant provider returned {exc.code}: {body}") from exc
    except httpx.HTTPStatusError as exc:
        body = exc.response.text[-500:]
        raise RuntimeError(f"assistant provider returned {exc.response.status_code}: {body}") from exc
    return _sidebar_provider_content(cfg.r2l_assistant_endpoint, data)


def _sidebar_provider_request(cfg: Settings, prompt: str) -> tuple[str, dict[str, object]]:
    system_prompt = "你是 AICourse 的中文 AI 教师。回答必须稳定、准确、面向学习者。"
    if _is_responses_endpoint(cfg.r2l_assistant_endpoint or ""):
        return (cfg.r2l_assistant_endpoint or "").rstrip("/"), {
            "model": cfg.r2l_assistant_model,
            "input": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "text": {"format": _assistant_response_text_format()},
        }
    return _chat_completions_url(cfg.r2l_assistant_endpoint or ""), {
        "model": cfg.r2l_assistant_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }


def _sidebar_provider_content(endpoint: str | None, data: dict[str, object]) -> str:
    if _is_responses_endpoint(endpoint or ""):
        output_text = data.get("output_text")
        if isinstance(output_text, str) and output_text:
            return output_text
        output = data.get("output")
        if isinstance(output, list):
            chunks = _response_output_chunks(output)
            if chunks:
                return "".join(chunks)
        raise RuntimeError("assistant responses payload did not include output_text")
    choices = data["choices"]
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("assistant chat payload did not include choices")
    first = choices[0]
    if not isinstance(first, dict):
        raise RuntimeError("assistant chat choice is malformed")
    message = first.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("assistant chat choice did not include message")
    content = message.get("content")
    if not isinstance(content, str):
        raise RuntimeError("assistant chat message did not include text content")
    return content


def _is_responses_endpoint(endpoint: str) -> bool:
    return endpoint.rstrip("/").endswith("/responses")


def _response_output_chunks(output: list[object]) -> list[str]:
    chunks: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if isinstance(content, str):
            chunks.append(content)
            continue
        if not isinstance(content, list):
            continue
        for block in content:
            if isinstance(block, str):
                chunks.append(block)
                continue
            if not isinstance(block, dict):
                continue
            text = block.get("text")
            if isinstance(text, str):
                chunks.append(text)
                continue
            block_content = block.get("content")
            if isinstance(block_content, str):
                chunks.append(block_content)
    return chunks


def _assistant_response_text_format() -> dict[str, Any]:
    return {
        "type": "json_schema",
        "name": "codex_sidebar_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "answer": {"type": "string"},
                "summary": {"type": "string"},
                "highlights": {"type": "array", "items": {"type": "string"}},
                "followUps": {"type": "array", "items": {"type": "string"}},
                "references": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "label": {"type": "string"},
                            "href": {"type": ["string", "null"]},
                        },
                        "required": ["label", "href"],
                    },
                },
            },
            "required": ["answer", "summary", "highlights", "followUps", "references"],
        },
    }


def _chat_completions_url(endpoint: str) -> str:
    base = endpoint.rstrip("/")
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
- 必须返回严格 JSON 对象，不要在 JSON 对象之外输出任何文字。
- 如果需要给代码示例，把 markdown 代码围栏放进 answer 字符串内部，例如 ```ts\\nconst x = 1;\\n```；不要用代码围栏包住整个 JSON。

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
  "answer": "用中文分段解释，建议包含：先说结论、为什么、例子、下一步。如包含代码，使用 markdown fenced code block 写在这个字符串里。",
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
