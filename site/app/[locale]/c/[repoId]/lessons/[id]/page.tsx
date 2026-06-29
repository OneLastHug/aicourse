import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/server/store";
import { CourseShell } from "@/components/CourseShell";
import { pick, neighbors } from "@/lib/content";
import { t } from "@/lib/i18n";
import { highlight } from "@/lib/highlight";
import { renderStepCodeBlock } from "@/lib/step-codeblock";
import { difficultyTheme, difficultyLabel } from "@/lib/ui";
import type { Course, Locale } from "@/lib/types";
import { StepSimulator, type SimStep } from "@/components/StepSimulator";
import { CompareTable } from "@/components/CompareTable";
import { References } from "@/components/References";
import { Mermaid } from "@/components/Mermaid";
import { ProgressRail } from "@/components/ProgressRail";
import { Prose } from "@/components/Prose";
import { HighlightedCode } from "@/components/HighlightedCode";

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
    lesson.howItWorks.map(async (s) => {
      const title = pick(s.title, loc);
      const desc = pick(s.desc, loc);
      const commentStyle = commentPrefixFor(s.code?.language ?? "");
      const decorated = s.code
        ? renderStepCodeBlock({
            title,
            description: desc,
            code: s.code.snippet,
            commentPrefix: commentStyle.prefix,
            commentSuffix: commentStyle.suffix,
            maxCommentWidth: 72,
          })
        : null;
      const commentLineOffset = s.code ? 1 + wrapDescriptionLines(desc, 72).length : 0;
      return {
        title,
        desc,
        file: s.code?.file,
        isSpine: s.code?.isSpine,
        symbol: s.code?.symbol,
        html: s.code && decorated
          ? await highlight(
              decorated,
              s.code.language,
              s.code.highlightLines.map((line) => line + commentLineOffset),
            )
          : null,
      };
    }),
  );
  const { prev, next, index, total } = neighbors(course.outline.lessons, id);

  const sp = lesson.spine;
  const changesHtml =
    sp?.prevLessonId && sp.addedLines && sp.addedLines.length
      ? await highlight(sp.code, sp.language, sp.addedLines)
      : null;

  return (
    <CourseShell course={course} locale={loc} repoId={repoId} activeId={id}>
      <article className="animate-fadeUp px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
            <Link href={`/${loc}/c/${repoId}`} className="hover:text-brand">{pick(course.outline.course.title, loc)}</Link>
            <span>/</span>
            <span className="font-mono">{id}</span>
          </div>
          <ProgressRail lessons={course.outline.lessons} activeId={id} locale={loc} repoId={repoId} />
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand font-mono text-base font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{pick(meta.title, loc)}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${difficultyTheme(meta.difficulty).chip}`}>{difficultyLabel(meta.difficulty, loc)}</span>
                <span>·</span>
                <span className="font-mono">{lesson.loc} {t(loc, "lesson.locUnit")}</span>
                {meta.tags.map((tg) => (
                  <span key={tg} className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono dark:bg-zinc-800">#{tg}</span>
                ))}
                {lesson.badges?.concepts.map((cpt) => (
                  <span key={cpt} className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-brand">{cpt}</span>
                ))}
              </div>
            </div>
          </div>

          {lesson.principle && (
            <p className="mt-5 border-l-4 border-brand pl-4 text-lg font-semibold italic leading-relaxed text-ink dark:text-zinc-100">
              {pick(lesson.principle, loc)}
            </p>
          )}
          {meta.objective && (
            <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft dark:text-zinc-400">
              <span className="mt-0.5 shrink-0 rounded bg-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint dark:bg-zinc-800 dark:text-zinc-500">{t(loc, "lesson.objective")}</span>
              <span>{pick(meta.objective, loc)}</span>
            </p>
          )}
          {(lesson.teachingScope || meta.whyNow || meta.nextPressure) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {lesson.teachingScope && <MiniCard label="Scope" value={pick(lesson.teachingScope, loc)} />}
              {meta.whyNow && <MiniCard label="Why now" value={pick(meta.whyNow, loc)} />}
              {meta.nextPressure && <MiniCard label="Next pressure" value={pick(meta.nextPressure, loc)} />}
            </div>
          )}

          <Section label={t(loc, "lesson.problem")} accent>
            <p className="text-lg font-medium leading-relaxed text-ink dark:text-zinc-100">{pick(lesson.problem, loc)}</p>
            {lesson.solution && (
              <blockquote className="mt-4 border-l-4 border-brand/70 bg-bg-subtle px-4 py-3 text-[15px] font-medium text-ink dark:bg-zinc-900 dark:text-zinc-100">
                {pick(lesson.solution, loc)}
              </blockquote>
            )}
          </Section>

          <Section label={t(loc, "lesson.how")}>
            {lesson.diagram && (
              <div className="mb-4">
                <Mermaid chart={lesson.diagram.diagram} caption={pick(lesson.diagram.caption, loc)} />
              </div>
            )}
            {steps.length ? <StepSimulator steps={steps} locale={loc} /> : <p className="lead">{t(loc, "lesson.nosteps")}</p>}
          </Section>

          {changesHtml && sp && (
            <Section label={t(loc, "lesson.changes")}>
              <div className="mb-2 flex items-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
                <span className="font-mono">{sp.prevLessonId} → {id}</span>
                <span>·</span>
                <span>{t(loc, "lesson.changesHint")}</span>
              </div>
              <div className="code-wrap overflow-x-auto rounded-xl" dangerouslySetInnerHTML={{ __html: changesHtml }} />
              {sp.runCmd && (
                <div className="mt-2 font-mono text-[11px] text-ink-faint dark:text-zinc-500">$ {sp.runCmd}</div>
              )}
            </Section>
          )}

          <Section label={t(loc, "lesson.deep")}>
            <Prose text={pick(lesson.deepDive, loc)} className="lead text-[15px]" />
            {lesson.references.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint dark:text-zinc-500">{t(loc, "lesson.further")}</div>
                <References items={lesson.references} locale={loc} />
              </div>
            )}
          </Section>

          {lesson.deepSource && (
            <Section label={t(loc, "lesson.source")}>
              <Prose text={pick(lesson.deepSource, loc)} className="lead text-[15px]" />
            </Section>
          )}

          {lesson.sourceCompare?.gaps?.length ? (
            <Section label="Source Compare">
              <div className="overflow-hidden rounded-2xl border border-line dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-subtle text-xs uppercase tracking-wide text-ink-faint dark:bg-zinc-900 dark:text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Dimension</th>
                      <th className="px-4 py-3">Teaching</th>
                      <th className="px-4 py-3">Real</th>
                      <th className="px-4 py-3">Why simplified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lesson.sourceCompare.gaps.map((gap, idx) => (
                      <tr key={idx} className="border-t border-line align-top dark:border-zinc-800">
                        <td className="px-4 py-3 font-medium">{pick(gap.dimension, loc)}</td>
                        <td className="px-4 py-3 text-ink-soft dark:text-zinc-300">{pick(gap.simplified, loc)}</td>
                        <td className="px-4 py-3 text-ink-soft dark:text-zinc-300">{pick(gap.real, loc)}</td>
                        <td className="px-4 py-3 text-ink-faint dark:text-zinc-400">{pick(gap.whySimplified, loc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          {lesson.tryIt && (
            <Section label={t(loc, "lesson.tryIt")}>
              <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-300">
                {lesson.tryIt.setup?.length ? <TryBlock title="Setup" items={lesson.tryIt.setup.map((x) => pick(x, loc))} /> : null}
                <TryBlock title="Commands" items={lesson.tryIt.commands.map((x) => pick(x, loc))} code />
                <TryBlock title="Observe" items={lesson.tryIt.observe.map((x) => pick(x, loc))} />
              </div>
            </Section>
          )}

          {lesson.compare.rows.length > 0 && (
            <Section label={t(loc, "lesson.compare")}>
              <CompareTable rows={lesson.compare.rows} locale={loc} />
            </Section>
          )}

          {(lesson.whatsNext || next) && (
            <Section label={t(loc, "lesson.whatsNext")}>
              {lesson.whatsNext && (
                <p className="mb-4 text-sm leading-relaxed text-ink-soft dark:text-zinc-300">{pick(lesson.whatsNext, loc)}</p>
              )}
              {next && (
                <Link href={`/${loc}/c/${repoId}/lessons/${next.id}`} className="card group flex items-start gap-3 p-4 transition hover:-translate-y-0.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-subtle font-mono text-xs font-semibold text-ink-faint dark:bg-zinc-800 dark:text-zinc-400">{next.id}</span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold group-hover:text-brand">{pick(next.title, loc)}</span>
                    <span className="mt-0.5 line-clamp-2 text-xs text-ink-faint dark:text-zinc-500">{pick(next.theProblem, loc)}</span>
                  </span>
                  <span className="ml-auto self-center text-ink-faint group-hover:text-brand dark:text-zinc-600">→</span>
                </Link>
              )}
            </Section>
          )}

          <nav className="mt-10 flex items-stretch gap-3 border-t border-line pt-6 dark:border-zinc-800">
            {prev ? (
              <Link href={`/${loc}/c/${repoId}/lessons/${prev.id}`} className="card flex-1 p-3 transition hover:-translate-y-0.5">
                <div className="text-[11px] text-ink-faint dark:text-zinc-500">← {t(loc, "lesson.prev")}</div>
                <div className="truncate text-sm font-medium">{pick(prev.title, loc)}</div>
              </Link>
            ) : <div className="flex-1" />}
            {next ? (
              <Link href={`/${loc}/c/${repoId}/lessons/${next.id}`} className="card flex-1 p-3 text-right transition hover:-translate-y-0.5">
                <div className="text-[11px] text-ink-faint dark:text-zinc-500">{t(loc, "lesson.next")} →</div>
                <div className="truncate text-sm font-medium">{pick(next.title, loc)}</div>
              </Link>
            ) : (
              <div className="flex-1 text-right text-xs text-ink-faint dark:text-zinc-500">{t(loc, "lesson.finished")} ({total}/{total})</div>
            )}
          </nav>
        </div>
      </article>
    </CourseShell>
  );
}

function Section({ label, accent, children }: { label: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className={`mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${accent ? "text-brand" : "text-ink-faint dark:text-zinc-500"}`}>
        <span className="h-px w-5 bg-current opacity-50" />{label}
      </h2>
      {children}
    </section>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{label}</div>
      <div className="mt-1 text-sm leading-relaxed text-ink-soft dark:text-zinc-300">{value}</div>
    </div>
  );
}

function TryBlock({ title, items, code = false }: { title: string; items: string[]; code?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</div>
      <div className="space-y-2">
        {items.map((item, idx) =>
          code ? (
            <HighlightedCode
              key={idx}
              code={item}
              language="bash"
              className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[13px] leading-relaxed text-zinc-300"
            />
          ) : (
            <p key={idx} className="text-[13px] leading-relaxed text-zinc-300">{item}</p>
          ),
        )}
      </div>
    </div>
  );
}

function commentPrefixFor(language: string): { prefix: string; suffix: string } {
  const lang = language.toLowerCase();
  if (["html", "xml", "svg"].includes(lang)) return { prefix: "<!-- ", suffix: " -->" };
  if (["css"].includes(lang)) return { prefix: "/* ", suffix: " */" };
  if (["bash", "shell", "sh", "python", "py", "yaml", "yml"].includes(lang)) return { prefix: "# ", suffix: "" };
  return { prefix: "// ", suffix: "" };
}

function wrapDescriptionLines(text: string, width: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= width) {
      current = word;
      continue;
    }
    let rest = word;
    while (rest.length > width) {
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines;
}
