"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { pick } from "@/lib/content";
import { t } from "@/lib/i18n";
import { difficultyColor } from "@/lib/ui";
import type { Difficulty, Locale, ProgressEvent } from "@/lib/types";
import { cn } from "@/lib/cn";

type Status = "running" | "done" | "error";
interface PlanLesson { id: string; title: { zh: string; en: string }; difficulty: Difficulty; }

const STAGE_STEP: Record<string, number> = {
  queued: 0, ingest: 0,
  analyze: 1, curriculum: 1,
  lessons: 2, "lesson:read": 2, "lesson:write": 2, validate1: 2, validate2: 2,
  translate: 3, render: 3, done: 3,
};

function tsNow(): string { return new Date().toLocaleTimeString("en-US", { hour12: false }); }

export default function ProgressPage() {
  const params = useParams<{ locale: string; id: string }>();
  const locale: Locale = params?.locale === "zh" ? "zh" : "en";
  const id = params.id;
  const router = useRouter();

  const [repoUrl, setRepoUrl] = useState("");
  const [repoId, setRepoId] = useState<string | null>(null);
  const [stage, setStage] = useState("queued");
  const [plan, setPlan] = useState<PlanLesson[]>([]);
  const [lessonStatus, setLessonStatus] = useState<Record<string, "start" | "ok" | "failed">>({});
  const done = useMemo(() => Object.values(lessonStatus).filter((s) => s === "ok" || s === "failed").length, [lessonStatus]);
  const [status, setStatus] = useState<Status>("running");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<{ time: string; level: string; text: string; source?: string }[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [preview, setPreview] = useState<{ id: string; data: Record<string, unknown> } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function addLine(e: ProgressEvent) {
    if (e.type === "stage") {
      setStage(e.stage);
      if (e.stage === "done") setStatus("done");
      if (e.label) setLines((p) => [...p, { time: tsNow(), level: "stage", text: e.label!, source: e.stage }]);
    } else if (e.type === "plan") {
      setPlan(e.lessons);
    } else if (e.type === "lesson") {
      setLessonStatus((prev) => ({ ...prev, [e.id]: e.status }));
      if (e.status === "start") setLines((p) => [...p, { time: tsNow(), level: "info", text: e.id + " → started", source: e.id }]);
      if (e.status === "ok") setLines((p) => [...p, { time: tsNow(), level: "ok", text: e.id + " → done ✓", source: e.id }]);
      if (e.status === "failed") setLines((p) => [...p, { time: tsNow(), level: "warn", text: e.id + " → FAILED", source: e.id }]);
    } else if (e.type === "log") {
      const source = e.message.split(":")[0] || "";
      setLines((p) => [...p, { time: tsNow(), level: e.level, text: e.message, source }]);
    } else if (e.type === "validation") {
      setLines((p) => [...p, { time: tsNow(), level: e.passed ? "ok" : "warn", text: "validate-" + e.round + ": " + (e.passed ? "passed" : e.issueCount + " issues"), source: "validate" + e.round }]);
    } else if (e.type === "error") {
      setError(e.message); setStatus("error");
      setLines((p) => [...p, { time: tsNow(), level: "error", text: e.message, source: "error" }]);
    }
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/jobs/" + id).then((r) => r.json()).then((j) => {
      if (!alive || !j || j.error) return;
      setRepoUrl(j.repoUrl || ""); setRepoId(j.repoId || null);
      setStage(j.stage || "queued");
      if (j.startedAt) { }
      if (j.status === "done") setStatus("done");
      if (j.status === "error") { setStatus("error"); setError(j.error || t(locale, "prog.errorUnknown")); }
      for (const e of (j.events || []) as ProgressEvent[]) addLine(e);
    }).catch(() => {});
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const es = new EventSource("/api/jobs/" + id + "/stream");
    es.onmessage = (ev) => { let e: ProgressEvent; try { e = JSON.parse(ev.data); } catch { return; } addLine(e); };
    return () => es.close();
  }, [id]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [lines]);

  async function retryGen() {
    if (!repoUrl || retrying) return;
    setRetrying(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repoUrl }) });
      if (!res.ok) { setRetrying(false); return; }
      const data = await res.json();
      if (data.ready) router.push("/" + locale + "/c/" + data.repoId);
      else if (data.id) router.push("/" + locale + "/j/" + data.id);
    } catch { setRetrying(false); }
  }

  async function openPreview(lid: string) {
    try { const r = await fetch("/api/jobs/" + id + "/lessons/" + lid); if (r.ok) setPreview({ id: lid, data: await r.json() }); } catch {}
  }

  const railSteps = [
    { label: t(locale, "stage.ingest") },
    { label: t(locale, "stage.analyze") },
    { label: t(locale, "stage.lessons") },
    { label: t(locale, "stage.done") },
  ];
  const stageIdx = STAGE_STEP[stage] ?? 0;
  const chip = status === "done" ? t(locale, "prog.ready") : status === "error" ? t(locale, "prog.failed") : t(locale, "prog.generating");
  const total = plan.length;

  // Filter terminal lines by active tab
  const filteredLines = activeTab === "all" ? lines : lines.filter((l) => l.source === activeTab || (activeTab === "system" && (l.source === "ingest" || l.source === "analyze" || l.source === "curriculum" || l.source === "translate" || l.source === "done" || l.source === "validate1" || l.source === "validate2" || l.source === "error")));

  // Build tabs from lesson ids + "all" + "system"
  const tabs = [{ id: "all", label: locale === "zh" ? "全部" : "All" }, { id: "system", label: locale === "zh" ? "系统" : "System" }, ...plan.map((l) => ({ id: l.id, label: l.id }))];

  const levelColor: Record<string, string> = { info: "text-zinc-400", ok: "text-emerald-400", warn: "text-amber-400", error: "text-rose-400", stage: "text-sky-400" };

  return (
    <>
      <TopBar title={t(locale, "brand")} locale={locale} />
      <main className="min-h-screen">
        <section className="mx-auto max-w-3xl px-5 py-10">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className={cn("h-2 w-2 rounded-full", status === "running" ? "animate-pulse bg-brand" : status === "done" ? "bg-emerald-500" : "bg-rose-500")} />
            <span className="text-sm font-medium">{chip}</span>
            <span className="ml-auto truncate font-mono text-xs text-ink-faint dark:text-zinc-500">{repoUrl || "…"}</span>
          </div>

          {/* Stage rail (compact horizontal) */}
          <div className="mt-4 flex items-center gap-1">
            {railSteps.map((s, i) => (
              <div key={i} className="flex flex-1 items-center">
                <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition",
                  i < stageIdx || status === "done" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : i === stageIdx ? "bg-brand/10 text-brand"
                  : "text-ink-faint dark:text-zinc-600")}>
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[10px]",
                    i < stageIdx || status === "done" ? "bg-emerald-500 text-white" : i === stageIdx ? "bg-brand text-white" : "bg-bg-subtle dark:bg-zinc-800")}>
                    {i < stageIdx || status === "done" ? "✓" : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < railSteps.length - 1 && <div className={cn("h-px flex-1", i < stageIdx ? "bg-emerald-500/30" : "bg-line dark:bg-zinc-800")} />}
              </div>
            ))}
          </div>

          {/* Lesson progress bar */}
          {total > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-ink-faint dark:text-zinc-500">
                <span>{t(locale, "prog.lessonsFilled")}</span>
                <span className="font-mono tabular-nums">{done}/{total}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle dark:bg-zinc-800">
                <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: String((total ? Math.round((done / total) * 100) : 0)) + "%" }} />
              </div>
              {/* Lesson chips grid */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {plan.map((l, i) => {
                  const st = lessonStatus[l.id];
                  const stCls = st === "ok" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-pointer hover:ring-2 hover:ring-emerald-500/20" : st === "failed" ? "bg-rose-500/10 text-rose-500" : st === "start" ? "bg-brand/10 text-brand animate-pulse" : "bg-bg-subtle text-ink-faint dark:bg-zinc-800 dark:text-zinc-600";
                  return <button key={l.id} onClick={st === "ok" ? () => openPreview(l.id) : undefined} className={cn("rounded px-1.5 py-1 text-center font-mono text-[10px] transition", stCls)}>{l.id}</button>;
                })}
              </div>
            </div>
          )}

          {/* Terminal panel */}
          <div className="mt-5 overflow-hidden rounded-xl2 border border-zinc-700 bg-zinc-950">
            {/* Title bar */}
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
              <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" /></div>
              <span className="ml-2 font-mono text-[11px] text-zinc-500">codex@repo2learn</span>
              {/* Tabs */}
              <div className="ml-auto flex items-center gap-1 overflow-x-auto">
                {tabs.map((tb) => (
                  <button key={tb.id} onClick={() => { setActiveTab(tb.id); }}
                    className={cn("rounded px-2 py-0.5 font-mono text-[10px] transition whitespace-nowrap",
                      activeTab === tb.id ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300")}>
                    {tb.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Terminal output (fixed height, scrollable) */}
            <div ref={scrollRef} className="h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
              {filteredLines.length === 0 ? (
                <div className="text-zinc-600">$ {locale === "zh" ? "等待 codex 输出..." : "waiting for codex output..."}</div>
              ) : (
                filteredLines.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 text-zinc-600">{l.time}</span>
                    <span className={cn("shrink-0 font-bold", levelColor[l.level] || "text-zinc-400")}>[{l.level.toUpperCase()}]</span>
                    <span className="text-zinc-300">{l.text}</span>
                  </div>
                ))
              )}
              {status === "running" && <div className="mt-1 animate-pulse text-brand">▊</div>}
            </div>
          </div>

          {/* Outcome */}
          {status === "done" && repoId && (
            <Link href={"/" + locale + "/c/" + repoId} className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-ink-soft dark:bg-white dark:text-zinc-900">
              {t(locale, "prog.open")} →
            </Link>
          )}
          {status === "error" && (
            <div className="mt-6">
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">{error || t(locale, "prog.errorUnknown")}</p>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={() => retryGen()} disabled={retrying || !repoUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ink-soft disabled:opacity-50 dark:bg-white dark:text-zinc-900">
                  {retrying ? <Dot /> : null}{t(locale, "prog.retry")} →
                </button>
                <Link href={"/" + locale + "/"} className="text-sm text-ink-faint underline-offset-2 hover:text-brand dark:text-zinc-400">← {t(locale, "brand")}</Link>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Lesson preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setPreview(null)}>
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-xs text-brand">{preview.id}</span>
              <button type="button" onClick={() => setPreview(null)} className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink-faint hover:bg-bg-subtle dark:border-zinc-700 dark:text-zinc-400">×</button>
            </div>
            <p className="mb-4 text-sm font-medium leading-relaxed text-ink dark:text-zinc-100">{String(preview.data.problem || "")}</p>
            {((preview.data.howItWorks as Array<Record<string, unknown>>) || []).map((step, i) => {
              const code = step.code as Record<string, unknown> | undefined;
              return (
                <div key={i} className="mb-4">
                  <div className="mb-1 text-sm font-semibold">{String(step.title || "")}</div>
                  <p className="mb-2 text-xs leading-relaxed text-ink-faint dark:text-zinc-400">{String(step.desc || "")}</p>
                  {code?.snippet ? (
                    <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[12px] leading-relaxed text-zinc-300">
                      <code>{String(code.snippet)}</code>
                    </pre>
                  ) : null}
                </div>
              );
            })}
            {preview.data.deepDive ? (
              <div className="mt-4 border-t border-line pt-4 dark:border-zinc-800">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint dark:text-zinc-500">{locale === "zh" ? "深入" : "Deep Dive"}</div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft dark:text-zinc-300">{String(preview.data.deepDive)}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function Dot() { return <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />; }
