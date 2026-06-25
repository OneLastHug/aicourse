import Link from "next/link";
import type { Locale, OutlineLesson } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Linear lesson progress rail (s01 → s02 → … → sN) with the current lesson
 *  highlighted — mirrors learn.shareai.run's chapter breadcrumb. */
export function ProgressRail({
  lessons,
  activeId,
  locale,
  repoId,
}: {
  lessons: OutlineLesson[];
  activeId: string;
  locale: Locale;
  repoId: string;
}) {
  return (
    <div className="-mx-1 mb-6 flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
      {lessons.map((l, i) => {
        const active = l.id === activeId;
        return (
          <div key={l.id} className="flex shrink-0 items-center gap-1">
            {i > 0 && <span className="text-ink-faint dark:text-zinc-600" aria-hidden>→</span>}
            <Link
              href={`/${locale}/c/${repoId}/lessons/${l.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono tabular-nums transition",
                active
                  ? "bg-brand font-semibold text-white"
                  : "text-ink-faint hover:bg-bg-subtle dark:text-zinc-500 dark:hover:bg-zinc-800",
              )}
            >
              {l.id}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
