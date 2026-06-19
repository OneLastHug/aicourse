"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { t } from "@/lib/i18n";
import type { Locale, ProgressEvent } from "@/lib/types";

type Status = "running" | "done" | "error";

export default function ProgressPage() {
  const params = useParams<{ locale: string; id: string }>();
  const locale: Locale = params?.locale === "zh" ? "zh" : "en";
  const id = params.id;
  const [repoUrl, setRepoUrl] = useState("");
  const [repoId, setRepoId] = useState<string | null>(null);
  const [stage, setStage] = useState("queued");
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [lessons, setLessons] = useState<Record<string, "start" | "ok" | "failed">>({});
  const [status, setStatus] = useState<Status>("running");
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs/${id}`).then((r) => r.json()).then((j) => {
      if (!alive || !j || j.error) return;
      setRepoUrl(j.repoUrl || ""); setRepoId(j.repoId || null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const es = new EventSource(`/api/jobs/${id}/stream`);
    es.onmessage = (ev) => {
      let e: ProgressEvent;
      try { e = JSON.parse(ev.data); } catch { return; }
      if (e.type === "stage") {
        setStage(e.stage);
        if (e.stage === "done") setStatus("done");
        if (e.label) setLog((l) => [...l, e.label!]);
      } else if (e.type === "plan") {
        setTotal(e.total);
      } else if (e.type === "lesson") {
        setLessons((prev) => ({ ...prev, [e.id]: e.status }));
        if (e.status === "ok" || e.status === "failed") setDone((d) => d + 1);
      } else if (e.type === "log") {
        setLog((l) => [...l, `[${e.level}] ${e.message}`]);
      } else if (e.type === "error") {
        setError(e.message); setStatus("error");
      }
    };
    return () => es.close();
  }, [id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [log]);

  const stages = [
    { key: "ingest", label: t(locale, "stage.ingest"), sub: t(locale, "stage.ingest.d") },
    { key: "outline", label: t(locale, "stage.architect"), sub: t(locale, "stage.architect.d") },
    { key: "content", label: t(locale, "stage.fill"), sub: t(locale, "stage.fill.d") },
    { key: "done", label: t(locale, "stage.done"), sub: t(locale, "stage.done.d") },
  ];
  const stageIdx = stages.findIndex((s) => s.key === stage);
  const chip = status === "done" ? t(locale, "prog.ready") : status === "error" ? t(locale, "prog.failed") : t(locale, "prog.generating");
  const h1 = status === "done" ? t(locale, "prog.h1Done") : t(locale, "prog.h1Run");

  return (
    <>
      <TopBar title={t(locale, "brand")} locale={locale} />
      <main className="min-h-screen">
        <section className="mx-auto max-w-2xl px-5 py-14">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {chip}
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{h1}</h1>
          <p className="mt-2 break-all font-mono text-sm text-ink-soft dark:text-zinc-400">{repoUrl || "…"}</p>

          <ol className="mt-8 space-y-1">
            {stages.map((s, i) => {
              const state = status === "error" && i === stageIdx ? "error" : i < stageIdx || status === "done" ? "done" : i === stageIdx ? "active" : "pending";
              return (
                <li key={s.key} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <span className={[
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition",
                    state === "done" ? "border-brand bg-brand text-white"
                      : state === "active" ? "border-brand text-brand"
                      : state === "error" ? "border-rose-500 text-rose-500"
                      : "border-line text-ink-faint dark:border-zinc-700 dark:text-zinc-500",
                  ].join(" ")}>
                    {state === "done" ? "✓" : state === "active" ? <Dot /> : state === "error" ? "!" : i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${state === "pending" ? "text-ink-faint dark:text-zinc-500" : ""}`}>{s.label}</div>
                    <div className="text-xs text-ink-faint dark:text-zinc-500">{s.sub}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          {(stage === "content" || total > 0) && (
            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between text-xs text-ink-faint dark:text-zinc-500">
                <span>{t(locale, "prog.lessonsFilled")}</span>
                <span className="font-mono">{done}/{total || "…"}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle dark:bg-zinc-800">
                <div className="h-full bg-brand transition-all duration-300" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
              </div>
              {Object.keys(lessons).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(lessons).map(([lid, st]) => (
                    <span key={lid} className={[
                      "rounded px-1.5 py-0.5 font-mono text-[11px]",
                      st === "ok" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : st === "failed" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-bg-subtle text-ink-faint dark:bg-zinc-800 dark:text-zinc-400",
                    ].join(" ")}>{lid}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div ref={scrollRef} className="mt-7 max-h-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
            {log.length === 0 ? <span className="text-zinc-600">{t(locale, "prog.waiting")}</span> : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>

          {status === "done" && repoId && (
            <Link href={`/${locale}/c/${repoId}`} className="mt-8 inline-flex items-center gap-1.5 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-soft dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
              {t(locale, "prog.open")} →
            </Link>
          )}
          {status === "error" && (
            <p className="mt-8 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">
              {error || t(locale, "prog.errorUnknown")}
            </p>
          )}
        </section>
      </main>
    </>
  );
}

function Dot() { return <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />; }
