"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export type SimStep = {
  title: string;
  desc: string;
  html: string | null;
  file?: string;
  isSpine?: boolean;
  symbol?: string;
};

export function StepSimulator({ steps, locale }: { steps: SimStep[]; locale: Locale }) {
  const [active, setActive] = useState(0);
  const step = steps[active];

  return (
    <div className="card overflow-hidden">
      {/* step rail */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 dark:border-zinc-800">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              i === active
                ? "bg-ink text-white dark:bg-white dark:text-zinc-900"
                : "border border-line bg-white text-ink-soft hover:bg-bg-subtle dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            <span className="tabular-nums opacity-60">{String(i + 1).padStart(2, "0")}</span>
            <span className="ml-1.5 hidden sm:inline">{s.title}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label={t(locale, "step.prev")}
            onClick={() => setActive((a) => Math.max(0, a - 1))}
            disabled={active === 0}
            className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink-faint transition enabled:hover:bg-bg-subtle disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400"
          >
            ←
          </button>
          <button
            type="button"
            aria-label={t(locale, "step.next")}
            onClick={() => setActive((a) => Math.min(steps.length - 1, a + 1))}
            disabled={active === steps.length - 1}
            className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink-faint transition enabled:hover:bg-bg-subtle disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400"
          >
            →
          </button>
        </div>
      </div>

      {/* progress */}
      <div className="h-0.5 w-full bg-bg-subtle dark:bg-zinc-800">
        <div
          className="h-full bg-brand transition-all duration-300"
          style={{ width: `${((active + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* active panel */}
      <div key={active} className="step-panel p-5" data-codex-kind={step?.html ? "code" : "text"} data-codex-file={step?.file} data-codex-step={step?.title}>
        {step?.html ? (
          <div className="code-wrap overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            {step.file && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-ink-faint dark:text-zinc-500">
                <FileGlyph />
                {step.file}
                {step.isSpine === true && (
                  <span className="rounded bg-brand/10 px-1.5 py-0.5 font-medium text-brand">{t(locale, "lesson.spineTag")}</span>
                )}
                {step.isSpine === false && (
                  <span className="rounded bg-bg-subtle px-1.5 py-0.5 font-medium dark:bg-zinc-800">
                    {t(locale, "lesson.realSourceTag")}{step.symbol ? ` · ${step.symbol}` : ""}
                  </span>
                )}
              </div>
            )}
            <div dangerouslySetInnerHTML={{ __html: step.html }} />
          </div>
        ) : (
          <div>
            <h4 className="text-[15px] font-semibold tracking-tight">
              <span className="mr-2 text-brand tabular-nums">{String(active + 1).padStart(2, "0")}</span>
              {step?.title}
            </h4>
            <p className="lead mt-2 text-sm">{step?.desc}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FileGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
