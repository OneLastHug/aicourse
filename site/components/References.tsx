import type { Reference, Locale } from "@/lib/types";
import { pick } from "@/lib/content";

function kindLabel(kind: Reference["kind"], locale: Locale): string | null {
  if (!kind) return null;
  const zh: Record<NonNullable<Reference["kind"]>, string> = {
    official: "官方",
    spec: "规范",
    paper: "论文",
    blog: "博客",
    other: "其他",
  };
  const en: Record<NonNullable<Reference["kind"]>, string> = {
    official: "official",
    spec: "spec",
    paper: "paper",
    blog: "blog",
    other: "other",
  };
  return locale === "zh" ? zh[kind] : en[kind];
}

export function References({ items, locale }: { items: Reference[]; locale: Locale }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-3">
      {items.map((r, i) => {
        const tag = kindLabel(r.kind, locale);
        return (
          <li key={i} className="rounded-xl border border-line bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft underline-offset-2 hover:text-brand hover:underline dark:text-zinc-200"
            >
              <span className="opacity-50">↗</span>
              {r.title}
              {tag && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand">{tag}</span>}
            </a>
            {r.whyUsed && (
              <p className="mt-2 text-xs leading-relaxed text-ink-faint dark:text-zinc-400">{pick(r.whyUsed, locale)}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
