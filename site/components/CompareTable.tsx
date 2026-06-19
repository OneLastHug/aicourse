import type { CompareRow, Locale } from "@/lib/types";
import { pick } from "@/lib/content";

export function CompareTable({
  rows,
  locale,
}: {
  rows: CompareRow[];
  locale: Locale;
}) {
  if (!rows.length) return null;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-faint dark:border-zinc-800 dark:text-zinc-500">
            <th className="p-3 font-semibold">{locale === "zh" ? "对比" : "Aspect"}</th>
            <th className="p-3 font-semibold">{locale === "zh" ? "朴素做法" : "Naïve"}</th>
            <th className="bg-brand/5 p-3 font-semibold text-brand">
              {locale === "zh" ? "本节方案" : "This lesson"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0 dark:border-zinc-800/70">
              <td className="p-3 font-medium align-top">{pick(r.label, locale)}</td>
              <td className="p-3 align-top text-ink-soft dark:text-zinc-400">{r.a}</td>
              <td className="bg-brand/5 p-3 align-top font-medium">{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
