"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CodexAssistantContext,
  CodexAssistantMode,
  CodexAssistantRequest,
  CodexAssistantResponse,
  CodexAssistantTurn,
} from "@/lib/codex-assistant";
import { syntaxClass, tokenizeCode } from "@/lib/syntax";
import type { Locale } from "@/lib/types";

interface CodexTeacherProps {
  repoId: string;
  locale: Locale;
  courseTitle: string;
  lessonId?: string;
  lessonTitle?: string;
  sectionTitle?: string;
}

interface SelectionSnapshot {
  text: string;
  rect: { top: number; left: number; width: number; height: number };
  kind: string;
  surroundingText: string;
  codeFile?: string;
  codeLanguage?: string;
  activeStep?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  response?: CodexAssistantResponse;
}

type MessageSegment =
  | { kind: "text"; text: string }
  | { kind: "code"; code: string; language: string };

const ACTIONS: { mode: CodexAssistantMode; zh: string; en: string }[] = [
  { mode: "explain", zh: "解释", en: "Explain" },
  { mode: "translate", zh: "白话", en: "Plain" },
  { mode: "example", zh: "举例", en: "Example" },
  { mode: "followup", zh: "追问", en: "Ask" },
  { mode: "quiz", zh: "出题", en: "Quiz" },
];

export function CodexTeacher({
  repoId,
  locale,
  courseTitle,
  lessonId,
  lessonTitle,
  sectionTitle,
}: CodexTeacherProps) {
  const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CodexAssistantMode>("explain");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const ui = useMemo(() => copy(locale), [locale]);

  const buildContext = useCallback(
    (snapshot: SelectionSnapshot | null, overrideText?: string): CodexAssistantContext => ({
      repoId,
      locale,
      courseTitle,
      lessonId,
      lessonTitle,
      sectionTitle,
      selectionText: overrideText ?? snapshot?.text ?? "",
      selectionKind: snapshot?.kind ?? "page",
      surroundingText: snapshot?.surroundingText,
      codeFile: snapshot?.codeFile,
      codeLanguage: snapshot?.codeLanguage,
      activeStep: snapshot?.activeStep,
    }),
    [courseTitle, lessonId, lessonTitle, locale, repoId, sectionTitle],
  );

  useEffect(() => {
    setMessages([]);
    setSelection(null);
    setQuestion("");
    setMode("explain");
    setError(null);
  }, [lessonId, repoId]);

  useEffect(() => {
    function readSelection() {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA"].includes(active.tagName)) return;
      const sel = window.getSelection();
      const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
      if (!sel || sel.rangeCount === 0 || text.length < 2) {
        setSelection(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const container = selectionContainer(range.commonAncestorContainer);
      const root = container?.closest("[data-codex-scope]");
      if (!root) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      const source = container?.closest("[data-codex-kind]") as HTMLElement | null;
      const kind = source?.dataset.codexKind ?? inferKind(container);
      const surroundingText = clip((source?.textContent || root.textContent || "").replace(/\s+/g, " "), 900);
      setSelection({
        text: clip(text, 2000),
        rect: {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        },
        kind,
        surroundingText,
        codeFile: source?.dataset.codexFile,
        codeLanguage: source?.dataset.codexLanguage,
        activeStep: source?.dataset.codexStep,
      });
      setQuestion((current) => current.trim() ? current : defaultQuestionForSelection(text, locale));
    }

    const onPointerUp = () => window.setTimeout(readSelection, 0);
    const onSelectionChange = () => window.setTimeout(readSelection, 0);
    const onKeyUp = () => readSelection();
    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("touchend", onPointerUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function ask(
    selectedMode = mode,
    text = question.trim(),
    selectionOverride?: SelectionSnapshot | null,
  ) {
    const effectiveSelection = selectionOverride === undefined ? selection : selectionOverride;
    const selectedText = effectiveSelection?.text ?? "";
    const displayQuestion = text || quickQuestion(selectedMode, locale, selectedText);
    setOpen(true);
    setMode(selectedMode);
    setQuestion("");
    setError(null);
    setLoading(true);

    const payload: CodexAssistantRequest = {
      question: displayQuestion,
      mode: selectedMode,
      context: buildContext(effectiveSelection, selectedText),
      history: messages
        .slice(-8)
        .filter((item): item is { role: "user" | "assistant"; content: string } => item.role === "user" || item.role === "assistant")
        .map<CodexAssistantTurn>((item) => ({ role: item.role, content: item.content })),
    };
    setMessages((prev) => prev.concat([{ role: "user", content: displayQuestion }]));

    try {
      const res = await fetch("/api/codex/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "request failed");
      const response = data as CodexAssistantResponse;
      setMessages((prev) => prev.concat([{ role: "assistant", content: response.answer, response }]));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : ui.error);
    } finally {
      setLoading(false);
      window.setTimeout(() => panelRef.current?.scrollTo({ top: panelRef.current.scrollHeight, behavior: "smooth" }), 0);
    }
  }

  function openWithoutSelection(selectedMode: CodexAssistantMode) {
    const fallback = {
      text: "",
      rect: { top: window.scrollY + 88, left: window.innerWidth - 440, width: 1, height: 1 },
      kind: "page",
      surroundingText: lessonTitle || courseTitle,
    };
    setSelection(fallback);
    void ask(selectedMode, "", fallback);
  }

  const safeWidth = windowSafeWidth();
  const triggerTop = selection ? Math.max(72, selection.rect.top - 46) : 96;
  const triggerLeft = selection
    ? Math.max(12, Math.min(Math.max(12, safeWidth - 250), selection.rect.left + selection.rect.width / 2 - 120))
    : 16;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink shadow-lg transition hover:-translate-y-0.5 hover:border-brand/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        aria-label={ui.open}
      >
        <SparkIcon />
        <span className="hidden sm:inline">{ui.floating}</span>
      </button>

      {selection && !open && (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 p-1 text-xs text-zinc-100 shadow-xl"
          style={{ top: triggerTop, left: triggerLeft }}
          role="toolbar"
          aria-label={ui.selectionActions}
        >
          {ACTIONS.map((action) => (
            <button
              key={action.mode}
              type="button"
              onClick={() => void ask(action.mode, "")}
              className="rounded-full px-2.5 py-1.5 font-medium transition hover:bg-white/10"
            >
              {locale === "zh" ? action.zh : action.en}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <button
            type="button"
            aria-label={ui.close}
            className="pointer-events-auto absolute inset-0 bg-black/20 md:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[86vh] flex-col rounded-t-2xl border border-line bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 md:inset-x-auto md:bottom-4 md:right-4 md:top-16 md:h-auto md:w-[400px] md:rounded-2xl">
            <header className="flex items-start gap-3 border-b border-line p-4 dark:border-zinc-800">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-white">
                <SparkIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{ui.title}</div>
                <div className="mt-0.5 truncate text-xs text-ink-faint dark:text-zinc-500">
                  {lessonId ? `${lessonId} · ${lessonTitle || courseTitle}` : courseTitle}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-ink-faint transition hover:bg-bg-subtle dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                aria-label={ui.close}
              >
                ×
              </button>
            </header>

            <div ref={panelRef} className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="rounded-xl border border-line bg-bg-subtle p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink dark:text-zinc-100">{ui.selected}</span>
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-faint dark:bg-zinc-800 dark:text-zinc-400">
                    {selection?.kind || "page"}
                  </span>
                </div>
                <p className="line-clamp-4 leading-relaxed text-ink-soft dark:text-zinc-300">
                  {selection?.text || ui.noSelection}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {ACTIONS.map((action) => (
                  <button
                    key={action.mode}
                    type="button"
                    onClick={() => void ask(action.mode, "")}
                    disabled={loading}
                    className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-brand/50 hover:text-brand disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {locale === "zh" ? action.zh : action.en}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => openWithoutSelection("summarize")}
                  disabled={loading}
                  className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-brand/50 hover:text-brand disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {ui.summarize}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {messages.length === 0 && (
                  <div className="rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-ink-faint dark:border-zinc-800 dark:text-zinc-500">
                    {ui.empty}
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={index} className={message.role === "user" ? "ml-8" : "mr-4"}>
                    <div className={message.role === "user"
                      ? "rounded-xl bg-ink px-3 py-2 text-sm leading-relaxed text-white dark:bg-white dark:text-zinc-900"
                      : "rounded-xl border border-line bg-white px-3 py-2 text-sm leading-relaxed text-ink-soft shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"}
                    >
                      <RenderedMessage content={message.content} copyLabel={ui.copyCode} copiedLabel={ui.copiedCode} />
                      {message.response?.highlights?.length ? (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {message.response.highlights.map((item) => (
                            <span key={item} className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">{item}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {message.response?.followUps?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.response.followUps.slice(0, 3).map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => void ask("followup", item)}
                            className="rounded-full border border-line bg-white px-2 py-1 text-[11px] text-ink-faint transition hover:border-brand/50 hover:text-brand dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {loading && (
                  <div className="mr-8 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
                    <span className="inline-flex items-center gap-2"><Dot />{ui.thinking}</span>
                  </div>
                )}
                {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
              </div>
            </div>

            <form
              className="border-t border-line p-3 dark:border-zinc-800"
              onSubmit={(event) => {
                event.preventDefault();
                if (!loading) void ask("followup", question.trim());
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={2}
                  placeholder={ui.placeholder}
                  className="min-h-[44px] flex-1 resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={loading || (!question.trim() && !selection?.text)}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink-soft disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                >
                  {ui.send}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

function inferKind(container: Element | null): string {
  if (!container) return "text";
  if (container.closest("pre, code, .code-wrap")) return "code";
  if (container.closest("figure")) return "diagram";
  return "text";
}

function selectionContainer(node: Node): Element | null {
  if (node.nodeType === Node.ELEMENT_NODE) return node as Element;
  const parent = node.parentNode;
  return parent instanceof Element ? parent : null;
}

function RenderedMessage({
  content,
  copyLabel,
  copiedLabel,
}: {
  content: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const segments = useMemo(() => parseMessageSegments(content), [content]);

  return (
    <div className="space-y-2">
      {segments.map((segment, index) =>
        segment.kind === "code" ? (
          <SidebarCodeBlock
            key={index}
            code={segment.code}
            language={segment.language}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
        ) : (
          <TextBlock key={index} text={segment.text} />
        ),
      )}
    </div>
  );
}

function TextBlock({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-wrap break-words">
          {paragraph}
        </p>
      ))}
    </>
  );
}

function SidebarCodeBlock({
  code,
  language,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  language: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const tokenLines = useMemo(() => tokenizeCode(code, language), [code, language]);
  const displayLanguage = language || "text";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex min-h-9 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/90 px-3 py-1.5">
        <span className="truncate font-mono text-[11px] uppercase tracking-wide text-zinc-400">
          {displayLanguage}
        </span>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-zinc-700 px-2 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          <CopyIcon />
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="syntax-fallback overflow-x-auto p-3 text-[12px] leading-relaxed">
        <code>
          {tokenLines.map((tokens, lineIndex) => (
            <span key={lineIndex} className="line">
              {tokens.length
                ? tokens.map((token, tokenIndex) => {
                    const tokenClass = syntaxClass(token.type);
                    return tokenClass ? (
                      <span key={tokenIndex} className={tokenClass}>
                        {token.text}
                      </span>
                    ) : (
                      token.text
                    );
                  })
                : " "}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fence = /```([A-Za-z0-9_+.-]*)[^\n]*\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(content)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: "text", text: content.slice(cursor, match.index) });
    }
    segments.push({
      kind: "code",
      language: match[1]?.trim() || "text",
      code: match[2]?.replace(/\n$/, "") ?? "",
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    const tail = content.slice(cursor);
    const openFence = /^```([A-Za-z0-9_+.-]*)[^\n]*\n([\s\S]*)$/.exec(tail);
    if (openFence) {
      segments.push({
        kind: "code",
        language: openFence[1]?.trim() || "text",
        code: openFence[2] ?? "",
      });
    } else {
      segments.push({ kind: "text", text: tail });
    }
  }
  return segments.length ? segments : [{ kind: "text", text: content }];
}

function quickQuestion(mode: CodexAssistantMode, locale: Locale, selectedText: string): string {
  const prefix = locale === "zh" ? "请" : "Please ";
  if (mode === "translate") return `${prefix}${locale === "zh" ? "把这段讲成更容易懂的中文白话" : "explain this in plain language"}`;
  if (mode === "example") return `${prefix}${locale === "zh" ? "围绕这段内容举一个例子" : "give one example for this selection"}`;
  if (mode === "quiz") return `${prefix}${locale === "zh" ? "基于这段内容出一道小题" : "make a short quiz from this selection"}`;
  if (mode === "summarize") return `${prefix}${locale === "zh" ? "总结这一节" : "summarize this lesson"}`;
  if (mode === "followup") return locale === "zh" ? "请结合这段内容继续解释" : "Please explain this selection further";
  return `${prefix}${locale === "zh" ? "解释这段内容" : "explain this selection"}`;
}

function defaultQuestionForSelection(selectedText: string, locale: Locale): string {
  const selected = clip(selectedText.replace(/\s+/g, " "), 120);
  return locale === "zh" ? `请解释：${selected}` : `Please explain: ${selected}`;
}

function copy(locale: Locale) {
  if (locale === "zh") {
    return {
      title: "Codex AI 教师",
      floating: "问 Codex",
      open: "打开 Codex AI 教师",
      close: "关闭",
      selected: "当前选区",
      selectionActions: "选区提问操作",
      noSelection: "没有选中文字，也可以直接问当前页面。",
      summarize: "总结本节",
      empty: "选中正文或代码后点击解释，也可以直接在下面追问。",
      thinking: "正在组织解释…",
      error: "请求失败",
      placeholder: "继续追问，例如：为什么这里要这样写？",
      copyCode: "复制",
      copiedCode: "已复制",
      send: "发送",
    };
  }
  return {
    title: "Codex AI Teacher",
    floating: "Ask Codex",
    open: "Open Codex AI teacher",
    close: "Close",
    selected: "Selection",
    selectionActions: "Selection actions",
    noSelection: "No selected text. You can ask about the current page.",
    summarize: "Summarize",
    empty: "Select prose or code, then ask for an explanation. You can also type a follow-up below.",
    thinking: "Thinking…",
    error: "Request failed",
    placeholder: "Ask a follow-up, e.g. why is this written this way?",
    copyCode: "Copy",
    copiedCode: "Copied",
    send: "Send",
  };
}

function clip(value: string, limit: number): string {
  const text = value.trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function windowSafeWidth() {
  return typeof window === "undefined" ? 1024 : window.innerWidth;
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
    </svg>
  );
}

function Dot() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
