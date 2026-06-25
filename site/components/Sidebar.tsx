import Link from "next/link";
import { pick } from "@/lib/content";
import { t } from "@/lib/i18n";
import { difficultyColor, difficultyLabel } from "@/lib/ui";
import type { Locale, OutlineLesson, OutlineSection } from "@/lib/types";
import { cn } from "@/lib/cn";

export function Sidebar({
  locale,
  repoId,
  lessons,
  sections,
  activeId,
}: {
  locale: Locale;
  repoId: string;
  lessons: OutlineLesson[];
  sections?: OutlineSection[];
  activeId?: string;
}) {
  // Group by section when available; otherwise one implicit group (flat list).
  const groups: { title: string | null; lessons: OutlineLesson[] }[] =
    sections && sections.length
      ? sections.map((s) => ({ title: pick(s.title, locale), lessons: s.lessons }))
      : [{ title: null, lessons }];

  // Global 1-based order across all groups (continuous numbering, like s01→sN).
  const order = new Map<string, number>();
  let n = 0;
  for (const g of groups) for (const l of g.lessons) order.set(l.id, ++n);

  return (
    <nav className="space-y-5">
      <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint dark:text-zinc-500">
        {t(locale, "course.path")} · s01 → s{String(lessons.length).padStart(2, "0")}
      </div>
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-1">
          {g.title && (
            <div className="flex items-center gap-2 px-2 pb-1">
              <span className="text-[12px] font-semibold text-ink dark:text-zinc-200">{g.title}</span>
              <span className="font-mono text-[10px] text-ink-faint dark:text-zinc-600">
                s{String(order.get(g.lessons[0]?.id ?? "") ?? 0).padStart(2, "0")}–s{String(order.get(g.lessons[g.lessons.length - 1]?.id ?? "") ?? 0).padStart(2, "0")}
              </span>
            </div>
          )}
          <ol className="relative">
            <span className="absolute left-[15px] top-2 bottom-2 w-px bg-line dark:bg-zinc-800" aria-hidden />
            {g.lessons.map((l) => {
              const active = l.id === activeId;
              const idx = order.get(l.id) ?? 0;
              return (
                <li key={l.id} className="relative">
                  <Link
                    href={`/${locale}/c/${repoId}/lessons/${l.id}`}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-lg px-2 py-2 transition",
                      active ? "bg-bg-subtle dark:bg-zinc-800/60" : "hover:bg-bg-subtle dark:hover:bg-zinc-800/40",
                    )}
                  >
                    <span
                      className={cn(
                        "z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition",
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-white text-ink-faint group-hover:border-ink-soft dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
                      )}
                    >
                      {String(idx).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className={cn("block truncate text-sm font-medium", active && "text-brand")}>
                        {pick(l.title, locale)}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", difficultyColor(l.difficulty))} />
                        <span className="text-[11px] text-ink-faint dark:text-zinc-500">
                          {difficultyLabel(l.difficulty, locale)}
                        </span>
                        <span className="text-[11px] text-ink-faint dark:text-zinc-600">·</span>
                        <span className="font-mono text-[11px] text-ink-faint dark:text-zinc-500">{l.id}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );
}
