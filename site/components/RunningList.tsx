"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

interface RunningItem { id: string; repoId: string; repoUrl: string; stage: string; lessonsDone: number; lessonsTotal: number; startedAt: number; }

function stageLabel(locale: Locale, stage: string): string {
  const map: Record<string, string> = {
    queued: locale === "zh" ? "排队中" : "queued",
    ingest: t(locale, "stage.ingest"),
    outline: t(locale, "stage.architect"),
    content: t(locale, "stage.fill"),
    done: t(locale, "stage.done"),
  };
  return map[stage] ?? stage;
}
function runningPct(r: RunningItem): number {
  if (r.stage === "done") return 100;
  if (r.stage === "content") return r.lessonsTotal > 0 ? 15 + Math.round((r.lessonsDone / r.lessonsTotal) * 80) : 15;
  if (r.stage === "outline") return 12;
  if (r.stage === "ingest") return 5;
  return 2;
}

export function RunningList({ locale }: { locale: Locale }) {
  const [running, setRunning] = useState<RunningItem[]>([]);
  useEffect(() => {
    const f = async () => {
      try { const r = await fetch("/api/dashboard"); if (r.ok) { const d = await r.json(); setRunning(d.running || []); } } catch {}
    };
    f();
    const iv = setInterval(f, 3000);
    return () => clearInterval(iv);
  }, []);
  if (running.length === 0) return null;
  return (
    <section className="mx-auto max-w-2xl px-5 pb-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(locale, "home.running")}</h2>
      <div className="space-y-2">
        {running.map((r) => {
          const pct = runningPct(r);
          return (
            <Link key={r.id} href={`/${locale}/j/${r.id}`} className="card relative flex items-center gap-3 overflow-hidden p-3 transition hover:-translate-y-0.5">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-subtle dark:bg-zinc-800"><Dot /><span className="absolute h-9 w-9 animate-ping rounded-lg bg-brand/20" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.repoUrl}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint dark:text-zinc-500">
                  <span className="capitalize">{stageLabel(locale, r.stage)}</span><span>·</span>
                  <span className="font-mono tabular-nums">{r.lessonsDone}/{r.lessonsTotal || "…"}</span><span>·</span>
                  <span className="font-mono tabular-nums">{pct}%</span>
                </div>
              </div>
              <span className="text-xs font-medium text-brand">{t(locale, "home.viewProgress")} →</span>
              <span className="absolute inset-x-0 bottom-0 h-1 bg-bg-subtle dark:bg-zinc-800">
                <span className="relative block h-full bg-brand transition-all duration-500 ease-out" style={{ width: pct + "%" }}>
                  <span className="shimmer-bar absolute inset-0" />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Dot() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
