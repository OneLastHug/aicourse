import Link from "next/link";
import { pick } from "@/lib/content";
import { t } from "@/lib/i18n";
import { difficultyColor, difficultyLabel } from "@/lib/ui";
import type { Locale, OutlineLesson } from "@/lib/types";
import { cn } from "@/lib/cn";

export function Sidebar({
  locale,
  repoId,
  lessons,
  activeId,
}: {
  locale: Locale;
  repoId: string;
  lessons: OutlineLesson[];
  activeId?: string;
}) {
  return (
    <nav className="space-y-1">
      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint dark:text-zinc-500">
        {t(locale, "course.path")} · s01 → s{String(lessons.length).padStart(2, "0")}
      </div>
      <ol className="relative">
        <span className="absolute left-[15px] top-2 bottom-2 w-px bg-line dark:bg-zinc-800" aria-hidden />
        {lessons.map((l, i) => {
          const active = l.id === activeId;
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
                  {String(i + 1).padStart(2, "0")}
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
    </nav>
  );
}
