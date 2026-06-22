"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { pick } from "@/lib/content";
import { t } from "@/lib/i18n";
import { difficultyColor } from "@/lib/ui";
import { etaSeconds, fmtClock } from "@/lib/duration";
import type { Difficulty, Locale, ProgressEvent } from "@/lib/types";

type Status = "running" | "done" | "error";
interface PlanLesson { id: string; title: { zh: string; en: string }; difficulty: Difficulty; }

/** Map each pipeline stage key onto one of the 4 rail steps (0..3). The v2
 *  pipeline emits ingest → analyze → curriculum → lessons → validate1/2 →
 *  translate → done; old records may still carry outline/content/render. */
const STAGE_STEP: Record<string, number> = {
  queued: 0, ingest: 0,
  outline: 1, analyze: 1, curriculum: 1,
  content: 2, lessons: 2, validate1: 2, validate2: 2, translate: 2, render: 2,
  done: 3,
};

export default function ProgressPage() {
  const params = useParams<{ locale: string; id: string }>();
  const locale: Locale = params?.locale === "zh" ? "zh" : "en";
  const id = params.id;

  const [repoUrl, setRepoUrl] = useState("");
  const [repoId, setRepoId] = useState<string | null>(null);
  const [stage, setStage] = useState("queued");
  const [plan, setPlan] = useState<PlanLesson[]>([]);
  const [lessonStatus, setLessonStatus] = useState<Record<string, "start" | "ok" | "failed">>({});
  const done = useMemo(
    () => Object.values(lessonStatus).filter((s) => s === "ok" || s === "failed").length,
    [lessonStatus],
  );
  const [status, setStatus] = useState<Status>("running");
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState("");
  const [preview, setPreview] = useState<{ id: string; data: Record<string, unknown> } | null>(null);
  async function openPreview(lid: string) {
    try {
      const r = await fetch("/api/jobs/" + id + "/lessons/" + lid);
      if (r.ok) setPreview({ id: lid, data: await r.json() });
    } catch {}
  }
  const [log, setLog] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  function applyEvent(e: ProgressEvent, silent: boolean) {
    if (e.type === "stage") {
      setStage(e.stage);
      if (e.stage === "done") setStatus("done");
      if (e.label) {
        setActivity(e.label);
        if (!silent) setLog((l) => l.concat([e.label as string]));
      }
    } else if (e.type === "plan") {
      setPlan(e.lessons);
    } else if (e.type === "lesson") {
      setLessonStatus((prev) => ({ ...prev, [e.id]: e.status }));
    } else if (e.type === "log") {
      const line = "[" + e.level + "] " + e.message;
      setActivity(line);
      if (!silent) setLog((l) => l.concat([line]));
    } else if (e.type === "error") {
      setError(e.message);
      setStatus("error");
    }
  }

  // initial state (replay history)
  useEffect(() => {
    let alive = true;
    fetch("/api/jobs/" + id)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j || j.error) return;
        setRepoUrl(j.repoUrl || "");
        setRepoId(j.repoId || null);
        if (j.startedAt) setStartedAt(j.startedAt);
        setStage(j.stage || "queued");
        if (j.status === "done") setStatus("done");
        if (j.status === "error") { setStatus("error"); setError(j.error || t(locale, "prog.errorUnknown")); }
        for (const e of (j.events || []) as ProgressEvent[]) applyEvent(e, true);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // SSE stream
  useEffect(() => {
    const es = new EventSource("/api/jobs/" + id + "/stream");
    es.onmessage = (ev) => {
      let e: ProgressEvent;
      try { e = JSON.parse(ev.data); } catch { return; }
      applyEvent(e, false);
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // elapsed timer
  useEffect(() => {
    if (status !== "running") return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [status, startedAt]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [log]);

  const stages = [
    { label: t(locale, "stage.ingest"), sub: t(locale, "stage.ingest.d") },
    { label: t(locale, "stage.architect"), sub: t(locale, "stage.architect.d") },
    { label: t(locale, "stage.fill"), sub: t(locale, "stage.fill.d") },
    { label: t(locale, "stage.done"), sub: t(locale, "stage.done.d") },
  ];
  // The pipeline emits fine-grained stages; collapse each onto one of the 4 rail
  // steps. (Old keys outline/content/render kept for replayed legacy job records.)
  const stageIdx = STAGE_STEP[stage] ?? 0;
  const chip = status === "done" ? t(locale, "prog.ready") : status === "error" ? t(locale, "prog.failed") : t(locale, "prog.generating");
  const h1 = status === "done" ? t(locale, "prog.h1Done") : status === "error" ? t(locale, "prog.failed") : t(locale, "prog.h1Run");
  const total = plan.length;
  // Remaining-time estimate, tied to the elapsed tick so it counts down each second.
  const eta = status === "running" ? etaSeconds(startedAt, startedAt + elapsed * 1000, stage, done, total) : null;

  return (
    <>
      <TopBar title={t(locale, "brand")} locale={locale} />
      <main className="min-h-screen">
        <section className="mx-auto max-w-2xl px-5 py-12">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <span className={"h-1.5 w-1.5 rounded-full " + (status === "running" ? "bg-brand animate-pulse" : status === "done" ? "bg-emerald-500" : "bg-rose-500")} />
              {chip}
            </div>
            {status === "running" && (
              <div className="ml-auto inline-flex items-center gap-1.5 font-mono text-xs text-ink-faint tabular-nums dark:text-zinc-500">
                <ClockIcon /> {fmtClock(elapsed)}
                {eta !== null && <span className="text-ink-faint/70 dark:text-zinc-600">· {t(locale, "prog.remaining")} ~{fmtClock(eta)}</span>}
              </div>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{h1}</h1>
          <p className="mt-2 break-all font-mono text-sm text-ink-soft dark:text-zinc-400">{repoUrl || "…"}</p>

          {/* stage rail */}
          <ol className="mt-7 space-y-1">
            {stages.map((s, i) => {
              const st = status === "error" && i === stageIdx ? "error" : (i < stageIdx || status === "done") ? "done" : i === stageIdx ? "active" : "pending";
              return (
                <li key={i} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                  <span className={"grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition " +
                    (st === "done" ? "border-brand bg-brand text-white" : st === "active" ? "border-brand text-brand" : st === "error" ? "border-rose-500 text-rose-500" : "border-line text-ink-faint dark:border-zinc-700 dark:text-zinc-500")}>
                    {st === "done" ? "✓" : st === "active" ? <Dot /> : st === "error" ? "!" : i + 1}
                  </span>
                  <div className={"text-sm font-medium " + (st === "pending" ? "text-ink-faint dark:text-zinc-500" : "")}>{s.label}</div>
                </li>
              );
            })}
          </ol>

          {/* live activity line */}
          {status === "running" && activity && (
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-line bg-bg-subtle px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <Dot /> <span className="truncate text-ink-soft dark:text-zinc-300">{activity}</span>
            </div>
          )}

          {/* per-lesson live grid */}
          {total > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs text-ink-faint dark:text-zinc-500">
                <span>{t(locale, "prog.lessonsFilled")}</span>
                <span className="font-mono tabular-nums">{done}/{total}</span>
              </div>
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle dark:bg-zinc-800">
                <div className="h-full bg-brand transition-all duration-300" style={{ width: ((total ? Math.round((done / total) * 100) : 0)) + "%" }} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {plan.map((l, i) => {
                  const st = lessonStatus[l.id];
                  const state = st === "ok" ? "ok" : st === "failed" ? "failed" : st === "start" ? "run" : "pending";
                  return (
                    <div key={l.id} onClick={state === "ok" ? () => openPreview(l.id) : undefined} className={"card flex items-center gap-3 p-3 transition-all duration-200 " + (state === "ok" ? "cursor-pointer hover:border-brand/40 " : "") + (state === "pending" ? "opacity-60" : "")}>
                      <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-semibold tabular-nums " +
                        (state === "ok" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : state === "failed" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : state === "run" ? "bg-brand/10 text-brand" : "bg-bg-subtle text-ink-faint dark:bg-zinc-800 dark:text-zinc-500")}>
                        {state === "ok" ? "✓" : state === "failed" ? "!" : state === "run" ? <Dot /> : String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{pick(l.title, locale)}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-faint dark:text-zinc-500">
                          <span className={"h-1.5 w-1.5 rounded-full " + difficultyColor(l.difficulty)} />
                          <span className="font-mono">{l.id}</span>
                          {state === "ok" && <span className="ml-auto text-brand">{locale === "zh" ? "预览" : "Read"} →</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* terminal log */}
          <div ref={scrollRef} className="mt-6 max-h-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
            {log.length === 0 ? <span className="text-zinc-600">{t(locale, "prog.waiting")}</span> : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>

          {/* outcome */}
          {status === "done" && repoId && (
            <Link href={"/" + locale + "/c/" + repoId} className="mt-7 inline-flex items-center gap-1.5 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-soft dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
              {t(locale, "prog.open")} →
            </Link>
          )}
          {status === "error" && (
            <div className="mt-7">
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">{error || t(locale, "prog.errorUnknown")}</p>
              <Link href={"/" + locale + "/"} className="mt-3 inline-flex items-center gap-1 text-sm text-ink-faint underline-offset-2 hover:text-brand dark:text-zinc-400">← {t(locale, "brand")}</Link>
            </div>
          )}
        </section>
      {/* Lesson preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setPreview(null)}>
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-xs text-brand">{preview.id}</span>
              <button type="button" onClick={() => setPreview(null)} className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink-faint hover:bg-bg-subtle dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">×</button>
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
            <div className="mt-3 text-[11px] text-ink-faint dark:text-zinc-600">{locale === "zh" ? "英文预览（翻译在最后阶段完成）" : "English preview (translation happens in the final stage)"}</div>
          </div>
        </div>
      )}
      </main>
    </>
  );
}

function Dot() { return <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />; }
function ClockIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
}
