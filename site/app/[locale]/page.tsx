import Link from "next/link";
import { course, pick } from "@/lib/content";
import { difficultyColor, difficultyLabel } from "@/lib/ui";
import type { Locale } from "@/lib/types";

export default async function CourseIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc: Locale = locale === "zh" ? "zh" : "en";
  const c = course.outline.course;
  const first = course.outline.lessons[0];
  return (
    <div className="animate-fadeUp px-5 py-10 sm:px-8 lg:px-12">
      {/* Hero */}
      <section className="mx-auto max-w-3xl">
        <div className="chip mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Repo2Learn · {c.repo.name}
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {pick(c.title, loc)}
        </h1>
        <p className="lead mt-4 text-lg">{pick(c.tagline, loc)}</p>

        <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
          <span className="chip">{c.repo.name}@{c.repo.sha}</span>
          <span className="chip">{course.outline.lessons.length} {loc === "zh" ? "节" : "lessons"}</span>
          <span className="chip">0 → 1</span>
          {first && (
            <Link
              href={`/${loc}/lessons/${first.id}`}
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-deep"
            >
              {loc === "zh" ? "开始学习" : "Start learning"} →
            </Link>
          )}
        </div>
      </section>

      {/* Lesson grid */}
      <section className="mx-auto mt-12 max-w-5xl">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-faint dark:text-zinc-500">
          {loc === "zh" ? "课程大纲" : "Curriculum"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {course.outline.lessons.map((l, i) => (
            <Link
              key={l.id}
              href={`/${loc}/lessons/${l.id}`}
              className="card group p-4 transition hover:-translate-y-0.5 hover:border-brand/40"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-subtle font-mono text-xs font-semibold text-ink-faint dark:bg-zinc-800 dark:text-zinc-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold group-hover:text-brand">
                    {pick(l.title, loc)}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint dark:text-zinc-500">
                    {pick(l.theProblem, loc)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${difficultyColor(l.difficulty)}`} />
                <span className="text-[11px] text-ink-faint dark:text-zinc-500">
                  {difficultyLabel(l.difficulty, loc)}
                </span>
                <span className="ml-auto font-mono text-[11px] text-ink-faint dark:text-zinc-600">
                  {l.id}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
