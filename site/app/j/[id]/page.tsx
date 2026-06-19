"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ProgressEvent } from "@/lib/types";

type Status = "running" | "done" | "error";

const STAGES: { key: string; label: string; sub: string }[] = [
  { key: "ingest", label: "Ingest", sub: "Clone & map the repo" },
  { key: "outline", label: "Architect", sub: "Plan layered s01 → sN" },
  { key: "content", label: "Fill lessons", sub: "5 concurrent sub-agents" },
  { key: "done", label: "Done", sub: "Render & serve" },
];

export default function ProgressPage() {
  const params = useParams<{ id: string }>();
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

  // initial state
  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j || j.error) return;
        setRepoUrl(j.repoUrl || "");
        setRepoId(j.repoId || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  // SSE stream
  useEffect(() => {
    const es = new EventSource(`/api/jobs/${id}/stream`);
    es.onmessage = (ev) => {
      let e: ProgressEvent;
      try {
        e = JSON.parse(ev.data);
      } catch {
        return;
      }
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
        setError(e.message);
        setStatus("error");
      }
    };
    es.onerror = () => {
      /* keep-alive pings arrive as comments; real close handled by terminal event */
    };
    return () => es.close();
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [log]);

  const stageIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]" />
      </div>

      <section className="mx-auto max-w-2xl px-5 py-16">
        <div className="chip mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {status === "done" ? "Course ready" : status === "error" ? "Generation failed" : "Generating…"}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {status === "done" ? "Your tutorial is ready" : "Building your layered tutorial"}
        </h1>
        <p className="mt-2 break-all font-mono text-sm text-ink-soft dark:text-zinc-400">
          {repoUrl || "…"}
        </p>

        {/* stage rail */}
        <ol className="mt-8 space-y-1">
          {STAGES.map((s, i) => {
            const state =
              status === "error" && i === stageIdx
                ? "error"
                : i < stageIdx || status === "done"
                  ? "done"
                  : i === stageIdx
                    ? "active"
                    : "pending";
            return (
              <li key={s.key} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <span
                  className={[
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition",
                    state === "done"
                      ? "border-brand bg-brand text-white"
                      : state === "active"
                        ? "border-brand text-brand"
                        : state === "error"
                          ? "border-rose-500 text-rose-500"
                          : "border-line text-ink-faint dark:border-zinc-700 dark:text-zinc-500",
                  ].join(" ")}
                >
                  {state === "done" ? "✓" : state === "active" ? <Dot /> : state === "error" ? "!" : i + 1}
                </span>
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${state === "pending" ? "text-ink-faint dark:text-zinc-500" : ""}`}>
                    {s.label}
                  </div>
                  <div className="text-xs text-ink-faint dark:text-zinc-500">{s.sub}</div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* lessons progress */}
        {(stage === "content" || total > 0) && (
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-xs text-ink-faint dark:text-zinc-500">
              <span>Lessons filled</span>
              <span className="font-mono">{done}/{total || "…"}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle dark:bg-zinc-800">
              <div
                className="h-full bg-brand transition-all duration-300"
                style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
              />
            </div>
            {Object.keys(lessons).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(lessons).map(([lid, st]) => (
                  <span
                    key={lid}
                    className={[
                      "rounded px-1.5 py-0.5 font-mono text-[11px]",
                      st === "ok"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : st === "failed"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "bg-bg-subtle text-ink-faint dark:bg-zinc-800 dark:text-zinc-400",
                    ].join(" ")}
                  >
                    {lid}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* terminal log */}
        <div ref={scrollRef} className="mt-7 max-h-40 overflow-y-auto rounded-xl2 border border-line bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-400 dark:border-zinc-800">
          {log.length === 0 ? (
            <span className="text-zinc-600">waiting for events…</span>
          ) : (
            log.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>

        {/* outcome */}
        {status === "done" && repoId && (
          <Link
            href={`/c/${repoId}`}
            className="mt-8 inline-flex items-center gap-1.5 rounded-xl2 bg-brand px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-deep"
          >
            Open the course →
          </Link>
        )}
        {status === "error" && (
          <p className="mt-8 rounded-xl2 border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">
            {error || "Something went wrong."}
          </p>
        )}
      </section>
    </main>
  );
}

function Dot() {
  return <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />;
}
