import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getCourse } from "@/lib/server/store";
import { CourseShell } from "@/components/CourseShell";
import { Mermaid } from "@/components/Mermaid";
import { SourceMapExplorer } from "@/components/SourceMapExplorer";
import { pick } from "@/lib/content";
import { t } from "@/lib/i18n";
import { difficultyTheme } from "@/lib/ui";
import {
  archetypeLabel,
  collectSourceMap,
  getConceptInventory,
  getCourseArchetype,
  getCourseModes,
  getCourseViews,
  getLessonMetrics,
  modeLabel,
  viewLabel,
} from "@/lib/course-views";
import type { Course, CourseGlobalView, Locale, OutlineLesson } from "@/lib/types";

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
  const views = getCourseViews(course);
  const archetype = getCourseArchetype(course);
  const modes = getCourseModes(course);
  const concepts = getConceptInventory(course, loc);
  const sourceMap = collectSourceMap(course, loc);
  const runnableCount = course.outline.lessons.filter((l) => getLessonMetrics(course, l).hasRunnableSpine).length;

  return (
    <CourseShell course={course} locale={loc} repoId={repoId}>
      <div className="animate-fadeUp px-5 py-8 sm:px-8 lg:px-12">
        <section className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Repo2Learn · {c.repo.name}</Badge>
            <Badge>{t(loc, "course.archetype")}: {archetypeLabel(archetype, loc)}</Badge>
            {modes.map((mode) => (
              <Badge key={mode}>{t(loc, "course.mode")}: {modeLabel(mode, loc)}</Badge>
            ))}
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                {pick(c.title, loc)}
              </h1>
              <p className="lead mt-4 max-w-3xl text-lg">{pick(c.tagline, loc)}</p>
              {c.thesis && (
                <p className="mt-4 max-w-3xl border-l-4 border-brand pl-4 text-base font-semibold italic text-ink dark:text-zinc-100">
                  {pick(c.thesis, loc)}
                </p>
              )}
            </div>
            {first && (
              <Link href={`/${loc}/c/${repoId}/lessons/${first.id}`} className="btn-primary w-full lg:w-auto">
                {t(loc, "course.start")} →
              </Link>
            )}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Metric label={t(loc, "course.unit")} value={String(course.outline.lessons.length)} />
            <Metric label={t(loc, "course.sourceFiles")} value={String(sourceMap.length)} />
            <Metric label={t(loc, "course.runSnapshots")} value={String(runnableCount)} />
          </div>

          {(c.learningOutcome || c.spine || c.whyThisOrder || c.audience) && (
            <div className="mt-7 grid gap-4 border-y border-line py-5 dark:border-zinc-800 lg:grid-cols-4">
              {c.learningOutcome && <InfoLine label={t(loc, "course.outcome")} value={pick(c.learningOutcome, loc)} />}
              {c.spine && <InfoLine label="Spine" value={pick(c.spine, loc)} />}
              {c.whyThisOrder && <InfoLine label="Order" value={pick(c.whyThisOrder, loc)} />}
              {c.audience && <InfoLine label="Audience" value={pick(c.audience, loc)} />}
            </div>
          )}

          {concepts.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(loc, "course.concepts")}</div>
              <div className="flex flex-wrap gap-2">
                {concepts.map((concept) => <Badge key={concept}>{concept}</Badge>)}
              </div>
            </div>
          )}

          <ViewNav views={views} locale={loc} />
        </section>

        {course.outline.archDiagram && (
          <section className="mx-auto mt-10 max-w-5xl">
            <Mermaid chart={course.outline.archDiagram.diagram} caption={pick(course.outline.archDiagram.caption, loc)} />
          </section>
        )}

        {!!course.outline.sections?.length && (
          <section id="layers" className="mx-auto mt-14 max-w-5xl scroll-mt-24">
            <SectionTitle eyebrow={t(loc, "course.layers")} title={t(loc, "course.sectionRole")} />
            <div className="space-y-6">
              {course.outline.sections.map((section) => (
                <div key={section.id} className="border-t border-line pt-5 dark:border-zinc-800">
                  <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-ink-faint dark:text-zinc-500">{section.id}</div>
                      <h3 className="mt-1 text-xl font-semibold">{pick(section.title, loc)}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-zinc-400">{pick(section.summary, loc)}</p>
                      {section.role && <p className="mt-3 text-xs leading-relaxed text-ink-faint dark:text-zinc-500">{pick(section.role, loc)}</p>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {section.lessons.map((lesson) => (
                        <LessonCard key={lesson.id} course={course} lesson={lesson} locale={loc} repoId={repoId} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="compare" className="mx-auto mt-14 max-w-5xl scroll-mt-24">
          <SectionTitle eyebrow={t(loc, "course.compare")} title="s01 → sN" />
          <div className="overflow-hidden rounded-xl border border-line dark:border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-bg-subtle text-xs uppercase tracking-wide text-ink-faint dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3">{t(loc, "course.lesson")}</th>
                  <th className="px-4 py-3">{t(loc, "course.mechanism")}</th>
                  <th className="px-4 py-3">{t(loc, "lesson.locUnit")}</th>
                  <th className="px-4 py-3">{t(loc, "course.sourceCoverage")}</th>
                </tr>
              </thead>
              <tbody>
                {course.outline.lessons.map((lesson) => {
                  const metrics = getLessonMetrics(course, lesson);
                  return (
                    <tr key={lesson.id} className="border-t border-line align-top dark:border-zinc-800">
                      <td className="px-4 py-3">
                        <Link href={`/${loc}/c/${repoId}/lessons/${lesson.id}`} className="font-medium hover:text-brand">{lesson.id} · {pick(lesson.title, loc)}</Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft dark:text-zinc-300">{lesson.mechanism ? pick(lesson.mechanism, loc) : lesson.tags.join(", ")}</td>
                      <td className="px-4 py-3 font-mono text-ink-faint dark:text-zinc-500">{metrics.loc || "—"}</td>
                      <td className="px-4 py-3 text-ink-soft dark:text-zinc-300">{metrics.sourceFiles.slice(0, 3).join(", ") || t(loc, "course.noSource")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section id="source-map" className="mx-auto mt-14 max-w-5xl scroll-mt-24">
          <SectionTitle eyebrow={t(loc, "course.sourceMap")} title={t(loc, "course.sourceFiles")} />
          {sourceMap.length ? (
            <SourceMapExplorer entries={sourceMap} locale={loc} repoId={repoId} />
          ) : (
            <p className="lead">{t(loc, "course.noSource")}</p>
          )}
        </section>

      </div>
    </CourseShell>
  );
}

function ViewNav({ views, locale }: { views: CourseGlobalView[]; locale: Locale }) {
  return (
    <nav className="mt-8 flex flex-wrap gap-2 border-t border-line pt-5 dark:border-zinc-800" aria-label={t(locale, "course.views")}>
      {views.map((view) => (
        <a key={view} href={`#${view}`} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-brand hover:text-brand dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {viewLabel(view, locale)}
        </a>
      ))}
    </nav>
  );
}

function LessonCard({ course, lesson, locale, repoId }: { course: Course; lesson: OutlineLesson; locale: Locale; repoId: string }) {
  const th = difficultyTheme(lesson.difficulty);
  const metrics = getLessonMetrics(course, lesson);
  return (
    <Link href={`/${locale}/c/${repoId}/lessons/${lesson.id}`} className={`group rounded-xl border bg-white p-5 transition hover:-translate-y-0.5 dark:bg-zinc-900 ${th.border}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-subtle font-mono text-xs font-semibold text-ink-faint dark:bg-zinc-800 dark:text-zinc-400">{lesson.id}</span>
        <div className="min-w-0">
          <h4 className="truncate text-[15px] font-semibold group-hover:text-brand">{pick(lesson.title, locale)}</h4>
          <p className="mt-1 line-clamp-2 text-xs text-ink-faint dark:text-zinc-500">{pick(lesson.theProblem, locale)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 pl-12">
        {lesson.mechanism && <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[11px] text-ink-soft dark:bg-zinc-800 dark:text-zinc-300">{pick(lesson.mechanism, locale)}</span>}
        {metrics.concepts.slice(0, 2).map((concept) => <span key={concept} className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand">{concept}</span>)}
      </div>
    </Link>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{eyebrow}</div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint dark:text-zinc-500">{label}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{label}</div>
      <div className="mt-1 text-sm leading-relaxed text-ink-soft dark:text-zinc-300">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}
