"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const EXAMPLES = [
  { label: "chalk", url: "https://github.com/chalk/chalk" },
  { label: "zod", url: "https://github.com/colinhacks/zod" },
  { label: "nanoid", url: "https://github.com/ai/nanoid" },
];

interface RunningItem { id: string; repoId: string; repoUrl: string; stage: string; lessonsDone: number; lessonsTotal: number; startedAt: number; }
interface CourseItem { repoId: string; url: string; name: string; title: string; createdAt: string; lessonCount: number; }
interface Dash { running: RunningItem[]; courses: CourseItem[]; }

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

/** Smooth 0–100 progress estimate combining stage + per-lesson completion. */
function runningPct(r: RunningItem): number {
  if (r.stage === "done") return 100;
  if (r.stage === "content") return r.lessonsTotal > 0 ? 15 + Math.round((r.lessonsDone / r.lessonsTotal) * 80) : 15;
  if (r.stage === "outline") return 12;
  if (r.stage === "ingest") return 5;
  return 2;
}

export default function Home() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale: Locale = params?.locale === "zh" ? "zh" : "en";
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dash, setDash] = useState<Dash>({ running: [], courses: [] });

  async function refresh() {
    try { const r = await fetch("/api/dashboard"); if (r.ok) setDash(await r.json()); } catch {}
  }
  useEffect(() => { refresh(); const iv = setInterval(refresh, 3000); return () => clearInterval(iv); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repoUrl: u }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "failed to start");
      if (data.ready) router.push(`/${locale}/c/${data.repoId}`);
      else router.push(`/${locale}/j/${data.id}`);
    } catch (e) {
      setLoading(false); setErr((e as Error).message);
    }
  }

  const steps = [
    { n: "01", t: t(locale, "home.step1.t"), d: t(locale, "home.step1.d") },
    { n: "02", t: t(locale, "home.step2.t"), d: t(locale, "home.step2.d") },
    { n: "03", t: t(locale, "home.step3.t"), d: t(locale, "home.step3.d") },
  ];
  const hasActivity = dash.running.length > 0 || dash.courses.length > 0;

  return (
    <>
      <TopBar title={t(locale, "brand")} locale={locale} />
      <main className="min-h-screen">
        <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />{t(locale, "home.badge")}
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-ink dark:text-zinc-50 sm:text-5xl lg:text-6xl">{t(locale, "home.title")}</h1>
          <p className="mt-4 max-w-xl text-balance text-base text-ink-faint dark:text-zinc-400 sm:text-xl">{t(locale, "home.subtitle")}</p>

          <form onSubmit={submit} className="mt-8 flex w-full max-w-xl items-center gap-2">
            <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t(locale, "home.placeholder")} spellCheck={false}
              className="h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm outline-none transition placeholder:text-ink-faint focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600" />
            <button type="submit" disabled={loading || !url.trim()}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
              {loading ? (<><Spinner /> {t(locale, "home.starting")}</>) : (<>{t(locale, "home.button")} →</>)}
            </button>
          </form>
          {err && <p className="mt-3 text-sm text-rose-500">{err}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
            <span>{t(locale, "home.try")}</span>
            {EXAMPLES.map((x) => (
              <button key={x.url} type="button" onClick={() => setUrl(x.url)} className="rounded-md px-2 py-0.5 font-mono text-ink-faint transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">{x.label}</button>
            ))}
          </div>
          <div className="mt-16 grid w-full max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="card p-4">
                <div className="font-mono text-xs text-brand">{s.n}</div>
                <div className="mt-1 text-sm font-semibold">{s.t}</div>
                <div className="mt-1 text-xs text-ink-faint dark:text-zinc-500">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Dashboard: in-progress + completed */}
        {hasActivity && (
          <section className="mx-auto max-w-2xl px-5 pb-20">
            {dash.running.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(locale, "home.running")}</h2>
                <div className="space-y-2">
                  {dash.running.map((r) => {
                    const pct = runningPct(r);
                    return (
                      <Link key={r.id} href={`/${locale}/j/${r.id}`} className="card relative flex items-center gap-3 overflow-hidden p-3 transition hover:-translate-y-0.5">
                        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-subtle dark:bg-zinc-800"><Spinner /><span className="absolute h-9 w-9 animate-ping rounded-lg bg-brand/20" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{r.repoUrl}</div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint dark:text-zinc-500">
                            <span className="capitalize">{stageLabel(locale, r.stage)}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">{r.lessonsDone}/{r.lessonsTotal || "…"}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">{pct}%</span>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-brand">{t(locale, "home.viewProgress")} →</span>
                        {/* animated progress bar that advances live */}
                        <span className="absolute inset-x-0 bottom-0 h-1 bg-bg-subtle dark:bg-zinc-800">
                          <span className="relative block h-full bg-brand transition-all duration-500 ease-out" style={{ width: pct + "%" }}>
                            <span className="shimmer-bar absolute inset-0" />
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            {dash.courses.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(locale, "home.completed")}</h2>
                <div className="space-y-2">
                  {dash.courses.map((c) => (
                    <Link key={c.repoId} href={`/${locale}/c/${c.repoId}`} className="card flex items-center gap-3 p-3 transition hover:-translate-y-0.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">✓</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.title}</div>
                        <div className="mt-1 text-[11px] text-ink-faint dark:text-zinc-500">{c.name} · {c.lessonCount} {t(locale, "course.unit")}</div>
                      </div>
                      <span className="text-xs font-medium text-brand">{t(locale, "home.openCourse")} →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
