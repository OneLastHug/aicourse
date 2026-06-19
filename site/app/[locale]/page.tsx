"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const EXAMPLES = [
  { label: "chalk", url: "https://github.com/chalk/chalk" },
  { label: "zod", url: "https://github.com/colinhacks/zod" },
  { label: "nanoid", url: "https://github.com/ai/nanoid" },
];

export default function Home() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale: Locale = params?.locale === "zh" ? "zh" : "en";
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl: u }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "failed to start");
      router.push(`/${locale}/j/${data.id}`);
    } catch (e) {
      setLoading(false);
      setErr((e as Error).message);
    }
  }

  const steps = [
    { n: "01", t: t(locale, "home.step1.t"), d: t(locale, "home.step1.d") },
    { n: "02", t: t(locale, "home.step2.t"), d: t(locale, "home.step2.d") },
    { n: "03", t: t(locale, "home.step3.t"), d: t(locale, "home.step3.d") },
  ];

  return (
    <>
      <TopBar title={t(locale, "brand")} locale={locale} />
      <main className="min-h-screen">
        <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {t(locale, "home.badge")}
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-ink dark:text-zinc-50 sm:text-5xl lg:text-6xl">
            {t(locale, "home.title")}
          </h1>
          <p className="mt-4 max-w-xl text-balance text-base text-ink-faint dark:text-zinc-400 sm:text-xl">
            {t(locale, "home.subtitle")}
          </p>

          <form onSubmit={submit} className="mt-8 flex w-full max-w-xl items-center gap-2">
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t(locale, "home.placeholder")}
              spellCheck={false}
              className="h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm outline-none transition placeholder:text-ink-faint focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? (<><Spinner /> {t(locale, "home.starting")}</>) : (<>{t(locale, "home.button")} →</>)}
            </button>
          </form>

          {err && <p className="mt-3 text-sm text-rose-500">{err}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
            <span>{t(locale, "home.try")}</span>
            {EXAMPLES.map((x) => (
              <button key={x.url} type="button" onClick={() => setUrl(x.url)}
                className="rounded-md px-2 py-0.5 font-mono text-ink-faint transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                {x.label}
              </button>
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
      </main>
    </>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
