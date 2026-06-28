import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/server/store";
import { CourseShell } from "@/components/CourseShell";
import { Mermaid } from "@/components/Mermaid";
import { pick } from "@/lib/content";
import { t } from "@/lib/i18n";
import { difficultyTheme, difficultyLabel } from "@/lib/ui";
import type { Course, Locale } from "@/lib/types";

const VALID: Locale[] = ["en", "zh"];

export default async function CourseHome({
  params,
}: {
  params: Promise<{ repoId: string; locale: string }>;
}) {
  const { repoId, locale } = await params;
  const loc: Locale = VALID.includes(locale as Locale) ? (locale as Locale) : "en";
  const course = (await getCourse(repoId)) as Course | null;
  if (!course) notFound();

  const c = course.outline.course;
  const first = course.outline.lessons[0];

  return (
    <CourseShell course={course} locale={loc} repoId={repoId}>
      <div className="animate-fadeUp px-5 py-10 sm:px-8 lg:px-12">
        <section className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Repo2Learn · {c.repo.name}
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {pick(c.title, loc)}
          </h1>
          <p className="lead mt-4 text-lg">{pick(c.tagline, loc)}</p>
          {c.thesis && (
            <p className="mt-3 text-balance border-l-4 border-brand pl-4 text-base font-semibold italic text-ink dark:text-zinc-100">
              {pick(c.thesis, loc)}
            </p>
          )}
          {(c.spine || c.whyThisOrder || c.audience) && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {c.spine && <InfoCard label="Spine" value={pick(c.spine, loc)} />}
              {c.whyThisOrder && <InfoCard label="Why this order" value={pick(c.whyThisOrder, loc)} />}
              {c.audience && <InfoCard label="Audience" value={pick(c.audience, loc)} />}
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">{c.repo.name}@{c.repo.sha}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">{course.outline.lessons.length} {t(loc, "course.unit")}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink-faint dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">0 → 1</span>
            {first && (
              <Link href={`/${loc}/c/${repoId}/lessons/${first.id}`} className="ml-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-soft dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                {t(loc, "course.start")} →
              </Link>
            )}
          </div>
        </section>

        {course.outline.archDiagram && (
          <section className="mx-auto mt-10 max-w-3xl">
            <Mermaid chart={course.outline.archDiagram.diagram} caption={pick(course.outline.archDiagram.caption, loc)} />
          </section>
        )}

        {!!course.outline.sections?.length && (
          <section className="mx-auto mt-12 max-w-5xl space-y-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">
              {t(loc, "course.path")} · s01 → s{String(course.outline.lessons.length).padStart(2, "0")}
            </h2>
            {course.outline.sections.map((section) => (
              <div key={section.id} className="rounded-2xl border border-line bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="mb-4 flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint dark:text-zinc-500">{section.id}</div>
                    <h3 className="mt-1 text-xl font-semibold">{pick(section.title, loc)}</h3>
                    <p className="mt-1 text-sm text-ink-soft dark:text-zinc-400">{pick(section.summary, loc)}</p>
                  </div>
                  {section.role && (
                    <div className="max-w-sm rounded-xl bg-bg-subtle px-3 py-2 text-xs leading-relaxed text-ink-soft dark:bg-zinc-800 dark:text-zinc-300">
                      {pick(section.role, loc)}
                    </div>
                  )}
                </div>
                {(section.transitionIn || section.transitionOut || section.spine) && (
                  <div className="mb-4 grid gap-3 md:grid-cols-3">
                    {section.transitionIn && <InfoCard label="Transition in" value={pick(section.transitionIn, loc)} compact />}
                    {section.spine && <InfoCard label="Section spine" value={pick(section.spine, loc)} compact />}
                    {section.transitionOut && <InfoCard label="Transition out" value={pick(section.transitionOut, loc)} compact />}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.lessons.map((l) => {
                    const th = difficultyTheme(l.difficulty);
                    return (
                      <Link key={l.id} href={`/${loc}/c/${repoId}/lessons/${l.id}`} className={`card group relative overflow-hidden p-5 transition-all duration-200 ${th.border}`}>
                        <span className={`absolute inset-y-0 left-0 w-1 ${th.solid}`} />
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-subtle font-mono text-xs font-semibold text-ink-faint dark:bg-zinc-800 dark:text-zinc-400">{l.id}</span>
                          <div className="min-w-0">
                            <h4 className="truncate text-[15px] font-semibold group-hover:text-brand">{pick(l.title, loc)}</h4>
                            <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint dark:text-zinc-500">{pick(l.theProblem, loc)}</p>
                          </div>
                        </div>
                        {l.mechanism && (
                          <div className="mt-3 pl-12 text-[11px] uppercase tracking-wide text-brand">{pick(l.mechanism, loc)}</div>
                        )}
                        <div className="mt-3 flex items-center gap-2 pl-12">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${th.chip}`}>{difficultyLabel(l.difficulty, loc)}</span>
                          <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-faint dark:text-zinc-600">{l.id}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </CourseShell>
  );
}

function InfoCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-line bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/60 ${compact ? "p-3" : "p-4"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{label}</div>
      <div className={`mt-1 text-ink dark:text-zinc-100 ${compact ? "text-sm" : "text-sm leading-relaxed"}`}>{value}</div>
    </div>
  );
}
