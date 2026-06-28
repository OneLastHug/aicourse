"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { getRunningPct, getStageLabel } from "@/lib/running-progress";
import type { Locale } from "@/lib/types";

interface RunningItem { id: string; repoId: string; repoUrl: string; stage: string; lessonsDone: number; lessonsTotal: number; startedAt: number; }
interface FailedItem { id: string; repoId: string; repoUrl: string; errorMsg?: string; updatedAt: number; stage: string; lessonsDone: number; lessonsTotal: number; }
interface CourseItem { repoId: string; url: string; name: string; title: string; createdAt: string; lessonCount: number; }

export function RunningList({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [running, setRunning] = useState<RunningItem[]>([]);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    const f = async () => {
      try { const r = await fetch("/api/dashboard"); if (r.ok) { const d = await r.json(); setRunning(d.running || []); setFailed(d.failed || []); } } catch {}
    };
    f();
    const iv = setInterval(f, 3000);
    return () => clearInterval(iv);
  }, []);

  async function retry(repoUrl: string) {
    setRetrying(repoUrl);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repoUrl }) });
      const data = await res.json();
      if (data.ready) router.push("/" + locale + "/c/" + data.repoId);
      else if (data.id) router.push("/" + locale + "/j/" + data.id);
    } catch { setRetrying(null); }
  }

  if (running.length === 0 && failed.length === 0) return null;

  return (
    <>
      {running.length > 0 && (
        <section className="mx-auto max-w-2xl px-5 pb-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(locale, "home.running")}</h2>
          <div className="space-y-2">
            {running.map((r) => {
              const pct = getRunningPct(r);
              return (
                <Link key={r.id} href={"/" + locale + "/j/" + r.id} className="card relative flex items-center gap-3 overflow-hidden p-3 transition hover:-translate-y-0.5">
                  <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-subtle dark:bg-zinc-800"><Dot /><span className="absolute h-9 w-9 animate-ping rounded-lg bg-brand/20" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.repoUrl}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint dark:text-zinc-500">
                      <span className="capitalize">{getStageLabel(locale, r.stage)}</span><span>·</span>
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
      )}

      {failed.length > 0 && (
        <section className="mx-auto max-w-2xl px-5 pb-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">{t(locale, "home.failed")}</h2>
          <div className="space-y-2">
            {failed.map((f) => (
              <div key={f.id} className="card flex items-center gap-3 border-rose-500/30 p-3 dark:border-rose-500/20">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-500">!</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.repoUrl}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-faint dark:text-zinc-500">{f.errorMsg || "error"}</div>
                  <div className="mt-0.5 text-[10px] text-ink-faint dark:text-zinc-600">
                    {getStageLabel(locale, f.stage)} · {f.lessonsDone}/{f.lessonsTotal || "…"} · auto-retry 10min
                  </div>
                </div>
                <button type="button" onClick={() => retry(f.repoUrl)} disabled={retrying === f.repoUrl}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-ink px-3 text-xs font-medium text-white transition hover:bg-ink-soft disabled:opacity-50 dark:bg-white dark:text-zinc-900">
                  {retrying === f.repoUrl ? <Dot /> : null}{t(locale, "home.retry")}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Dot() {
  return (<svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>);
}
