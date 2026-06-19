"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  { label: "chalk", url: "https://github.com/chalk/chalk" },
  { label: "zod", url: "https://github.com/colinhacks/zod" },
  { label: "nano-id", url: "https://github.com/ai/nanoid" },
];

export default function Home() {
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
      router.push(`/j/${data.id}`);
    } catch (e) {
      setLoading(false);
      setErr((e as Error).message);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient techy backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.18] dark:opacity-[0.25]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(120,120,130,.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,120,130,.35) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 35%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 35%, black, transparent)",
          }}
        />
      </div>

      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-5 py-20 text-center">
        <div className="chip mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          repo → layered tutorial · powered by codex
        </div>
        <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
          Turn any repository into a
          <span className="bg-gradient-to-r from-brand to-amber-500 bg-clip-text text-transparent">
            {" "}layered tutorial
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base text-ink-soft dark:text-zinc-400 sm:text-lg">
          Paste a Git URL. Codex pulls the repo, analyzes its architecture, then
          writes a from-0-to-1, bilingual, interactive course — one mechanism at a time.
        </p>

        <form onSubmit={submit} className="mt-9 flex w-full max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint dark:text-zinc-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            </span>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              spellCheck={false}
              className="w-full rounded-xl2 border border-line bg-white/70 py-3.5 pl-10 pr-3 text-sm shadow-soft outline-none transition placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-zinc-700 dark:bg-zinc-900/60 dark:placeholder:text-zinc-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="inline-flex h-[50px] items-center justify-center gap-1.5 rounded-xl2 bg-brand px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-deep disabled:opacity-50"
          >
            {loading ? (
              <>
                <Spinner /> Starting…
              </>
            ) : (
              <>Generate →</>
            )}
          </button>
        </form>

        {err && <p className="mt-3 text-sm text-rose-500">{err}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
          <span>Try:</span>
          {EXAMPLES.map((x) => (
            <button
              key={x.url}
              type="button"
              onClick={() => setUrl(x.url)}
              className="rounded-full border border-line px-2.5 py-0.5 font-mono transition hover:border-brand/50 hover:text-brand dark:border-zinc-700"
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-14 grid w-full max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {[
            { n: "01", t: "Ingest", d: "Clone & map the repo — tree, LOC, key files." },
            { n: "02", t: "Layer", d: "An architect agent plans s01 → sN, easy→hard." },
            { n: "03", t: "Fill", d: "5 concurrent sub-agents write each lesson from real code." },
          ].map((s) => (
            <div key={s.n} className="card p-4">
              <div className="font-mono text-xs text-brand">{s.n}</div>
              <div className="mt-1 text-sm font-semibold">{s.t}</div>
              <div className="mt-1 text-xs text-ink-faint dark:text-zinc-500">{s.d}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
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
