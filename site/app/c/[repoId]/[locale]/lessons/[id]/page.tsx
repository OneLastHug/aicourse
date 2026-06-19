import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/server/store";
import { CourseShell } from "@/components/CourseShell";
import { pick, neighbors } from "@/lib/content";
import { highlight } from "@/lib/highlight";
import { difficultyColor, difficultyLabel } from "@/lib/ui";
import { StepSimulator, type SimStep } from "@/components/StepSimulator";
import { CompareTable } from "@/components/CompareTable";
import { References } from "@/components/References";
import type { Course, Locale } from "@/lib/types";

const VALID: Locale[] = ["en", "zh"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ repoId: string; locale: string; id: string }>;
}) {
  const { repoId, locale, id } = await params;
  const course = await getCourse(repoId);
  if (!course) return {};
  const loc: Locale = locale === "zh" ? "zh" : "en";
  const lesson = course.outline.lessons.find((l) => l.id === id);
  if (!lesson) return {};
  return { title: `${pick(lesson.title, loc)} · ${pick(course.outline.course.title, loc)}` };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ repoId: string; locale: string; id: string }>;
}) {
  const { repoId, locale, id } = await params;
  const loc: Locale = VALID.includes(locale as Locale) ? (locale as Locale) : "en";
  const course = (await getCourse(repoId)) as Course | null;
  if (!course) notFound();
  const meta = course.outline.lessons.find((l) => l.id === id);
  const lesson = course.lessons[id];
  if (!meta || !lesson) notFound();

  const steps: SimStep[] = await Promise.all(
    lesson.howItWorks.map(async (s) => ({
      title: pick(s.title, loc),
      desc: pick(s.desc, loc),
      file: s.code?.file,
      html: s.code
        ? await highlight(s.code.snippet, s.code.language, s.code.highlightLines)
        : null,
    })),
  );

  const { prev, next, index, total } = neighbors(course.outline.lessons, id);

  return (
    <CourseShell course={course} locale={loc} activeId={id}>
      <article className="animate-fadeUp px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
            <Link href={`/c/${repoId}/${loc}`} className="hover:text-brand">
              {pick(course.outline.course.title, loc)}
            </Link>
            <span>/</span>
            <span className="font-mono">{id}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl2 bg-brand font-mono text-base font-bold text-white">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {pick(meta.title, loc)}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${difficultyColor(meta.difficulty)}`} />
                  {difficultyLabel(meta.difficulty, loc)}
                </span>
                <span>·</span>
                <span className="font-mono">{lesson.loc} LOC</span>
                {meta.tags.map((t) => (
                  <span key={t} className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono dark:bg-zinc-800">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Section label={loc === "zh" ? "问题" : "The Problem"} accent>
            <p className="text-lg font-medium leading-relaxed text-ink dark:text-zinc-100">
              {pick(lesson.problem, loc)}
            </p>
            <p className="lead mt-3">{pick(meta.objective, loc)}</p>
          </Section>

          <Section label={loc === "zh" ? "工作原理" : "How It Works"}>
            {steps.length ? (
              <StepSimulator steps={steps} />
            ) : (
              <p className="lead">{loc === "zh" ? "（暂无步骤）" : "(no steps)"}</p>
            )}
          </Section>

          <Section label={loc === "zh" ? "深入" : "Deep Dive"}>
            <p className="lead whitespace-pre-line">{pick(lesson.deepDive, loc)}</p>
            {lesson.references.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint dark:text-zinc-500">
                  {loc === "zh" ? "延伸阅读" : "Further reading"}
                </div>
                <References items={lesson.references} />
              </div>
            )}
          </Section>

          {lesson.compare.rows.length > 0 && (
            <Section label={loc === "zh" ? "对比" : "Compare"}>
              <CompareTable rows={lesson.compare.rows} locale={loc} />
            </Section>
          )}

          <nav className="mt-10 flex items-stretch gap-3 border-t border-line pt-6 dark:border-zinc-800">
            {prev ? (
              <Link href={`/c/${repoId}/${loc}/lessons/${prev.id}`} className="card flex-1 p-3 transition hover:-translate-y-0.5">
                <div className="text-[11px] text-ink-faint dark:text-zinc-500">← {loc === "zh" ? "上一节" : "Prev"}</div>
                <div className="truncate text-sm font-medium">{pick(prev.title, loc)}</div>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
            {next ? (
              <Link href={`/c/${repoId}/${loc}/lessons/${next.id}`} className="card flex-1 p-3 text-right transition hover:-translate-y-0.5">
                <div className="text-[11px] text-ink-faint dark:text-zinc-500">{loc === "zh" ? "下一节" : "Next"} →</div>
                <div className="truncate text-sm font-medium">{pick(next.title, loc)}</div>
              </Link>
            ) : (
              <div className="flex-1 text-right text-xs text-ink-faint dark:text-zinc-500">
                {loc === "zh" ? "恭喜，完成全部课程 🎉" : "You finished the course 🎉"} ({total}/{total})
              </div>
            )}
          </nav>
        </div>
      </article>
    </CourseShell>
  );
}

function Section({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2
        className={`mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${
          accent ? "text-brand" : "text-ink-faint dark:text-zinc-500"
        }`}
      >
        <span className="h-px w-5 bg-current opacity-50" />
        {label}
      </h2>
      {children}
    </section>
  );
}
