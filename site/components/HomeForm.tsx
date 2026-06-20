"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const EXAMPLES = [
  { label: "chalk", url: "https://github.com/chalk/chalk" },
  { label: "zod", url: "https://github.com/colinhacks/zod" },
  { label: "nanoid", url: "https://github.com/ai/nanoid" },
];

export function HomeForm({ locale }: { locale: Locale }) {
  const router = useRouter();
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
      if (data.ready) router.push(`/${locale}/c/${data.repoId}`);
      else router.push(`/${locale}/j/${data.id}`);
    } catch (e) {
      setLoading(false);
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="mt-8 flex w-full max-w-xl items-center gap-2">
        <input
          autoFocus value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder={t(locale, "home.placeholder")} spellCheck={false}
          className="h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm outline-none transition placeholder:text-ink-faint focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
        />
        <button type="submit" disabled={loading || !url.trim()}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
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
