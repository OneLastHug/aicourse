import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/server/store";
import { CourseShell } from "@/components/CourseShell";
import { pick, neighbors } from "@/lib/content";
import { t } from "@/lib/i18n";
import { highlight } from "@/lib/highlight";
import { renderStepCodeBlock } from "@/lib/step-codeblock";
import { difficultyTheme, difficultyLabel } from "@/lib/ui";
import type { Course, Locale, SimulationSpec } from "@/lib/types";
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
  const { locale, id, repoId } = await params;
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
    (lesson.howItWorks ?? []).map(async (s) => {
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
  const fullCodeHtml = sp ? await highlight(sp.code, sp.language, sp.addedLines ?? []) : null;
  const sourceSteps = (lesson.howItWorks ?? []).filter((step) => step.code?.isSpine === false);

  return (
    <CourseShell course={course} locale={loc} repoId={repoId} activeId={id}>
      <article className="animate-fadeUp px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 flex items-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
            <Link href={`/${loc}/c/${repoId}`} className="hover:text-brand">{pick(course.outline.course.title, loc)}</Link>
            <span>/</span>
            <span className="font-mono">{id}</span>
          </div>
          <ProgressRail lessons={course.outline.lessons} activeId={id} locale={loc} repoId={repoId} />

          <header className="border-b border-line pb-6 dark:border-zinc-800">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand font-mono text-base font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{pick(meta.title, loc)}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${difficultyTheme(meta.difficulty).chip}`}>{difficultyLabel(meta.difficulty, loc)}</span>
                  <span className="font-mono">{lesson.loc} {t(loc, "lesson.locUnit")}</span>
                  {meta.mechanism && <span className="rounded bg-bg-subtle px-1.5 py-0.5 dark:bg-zinc-800">{pick(meta.mechanism, loc)}</span>}
                  {(lesson.badges?.concepts ?? meta.tags).map((concept) => (
                    <span key={concept} className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-brand">{concept}</span>
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
              <p className="mt-4 flex items-start gap-2 text-sm text-ink-soft dark:text-zinc-400">
                <span className="mt-0.5 shrink-0 rounded bg-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint dark:bg-zinc-800 dark:text-zinc-500">{t(loc, "lesson.objective")}</span>
                <span>{pick(meta.objective, loc)}</span>
              </p>
            )}
          </header>

          <LessonTabs locale={loc} />

          <section id="learn" className="scroll-mt-28 pt-8">
            <SectionTitle label={t(loc, "lesson.tab.learn")} accent />
            {(lesson.teachingScope || meta.whyNow || meta.nextPressure) && (
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {lesson.teachingScope && <MiniCard label="Scope" value={pick(lesson.teachingScope, loc)} />}
                {meta.whyNow && <MiniCard label="Why now" value={pick(meta.whyNow, loc)} />}
                {meta.nextPressure && <MiniCard label="Next pressure" value={pick(meta.nextPressure, loc)} />}
              </div>
            )}
            <Panel>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{t(loc, "lesson.problem")}</div>
              <p className="text-lg font-medium leading-relaxed text-ink dark:text-zinc-100">{pick(lesson.problem, loc)}</p>
              {lesson.solution && (
                <blockquote className="mt-4 border-l-4 border-brand/70 bg-bg-subtle px-4 py-3 text-[15px] font-medium text-ink dark:bg-zinc-900 dark:text-zinc-100">
                  {pick(lesson.solution, loc)}
                </blockquote>
              )}
            </Panel>
            {lesson.diagram && (
              <div className="mt-5">
                <Mermaid chart={lesson.diagram.diagram} caption={pick(lesson.diagram.caption, loc)} />
              </div>
            )}
            <div className="mt-6">
              <SectionTitle label={t(loc, "lesson.deep")} />
              <Prose text={pick(lesson.deepDive, loc)} className="lead text-[15px]" />
            </div>
          </section>

          <section id="simulate" className="scroll-mt-28 pt-10">
            <SectionTitle label={t(loc, "lesson.tab.simulate")} />
            {lesson.simulation ? (
              <SimulationPanel spec={lesson.simulation} locale={loc} />
            ) : null}
            <div className={lesson.simulation ? "mt-5" : ""}>
              {steps.length ? <StepSimulator steps={steps} locale={loc} /> : <p className="lead">{t(loc, "lesson.nosteps")}</p>}
            </div>
          </section>

          <section id="code" className="scroll-mt-28 pt-10">
            <SectionTitle label={t(loc, "lesson.tab.code")} />
            {changesHtml && sp && (
              <Panel className="mb-5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint dark:text-zinc-500">
                  <span className="font-mono">{sp.prevLessonId} → {id}</span>
                  <span>·</span>
                  <span>{t(loc, "lesson.changesHint")}</span>
                </div>
                <div className="code-wrap overflow-x-auto rounded-xl" data-codex-kind="code" data-codex-file={sp.path} data-codex-language={sp.language} dangerouslySetInnerHTML={{ __html: changesHtml }} />
              </Panel>
            )}
            {fullCodeHtml && sp ? (
              <Panel>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(loc, "lesson.fullCode")}</div>
                  <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[11px] text-brand">{sp.path}</span>
                </div>
                <div className="code-wrap overflow-x-auto rounded-xl" data-codex-kind="code" data-codex-file={sp.path} data-codex-language={sp.language} dangerouslySetInnerHTML={{ __html: fullCodeHtml }} />
                {sp.runCmd && (
                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(loc, "lesson.runCommand")}</div>
                    <HighlightedCode code={sp.runCmd} language="bash" className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[13px] leading-relaxed text-zinc-300" />
                  </div>
                )}
              </Panel>
            ) : (
              <p className="lead">{t(loc, "lesson.nosteps")}</p>
            )}
          </section>

          <section id="source" className="scroll-mt-28 pt-10">
            <SectionTitle label={t(loc, "lesson.tab.source")} />
            {lesson.deepSource && (
              <Panel className="mb-5">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(loc, "lesson.source")}</div>
                <Prose text={pick(lesson.deepSource, loc)} className="lead text-[15px]" />
              </Panel>
            )}
            {sourceSteps.length > 0 && (
              <Panel className="mb-5">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(loc, "lesson.sourceMapping")}</div>
                <div className="space-y-3">
                  {sourceSteps.map((step, idx) => (
                    <div key={`${step.code?.file}-${idx}`} className="rounded-lg border border-line bg-bg-subtle p-3 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="font-mono text-[11px] text-ink-faint dark:text-zinc-500">{step.code?.file}{step.code?.symbol ? ` · ${step.code.symbol}` : ""}</div>
                      <div className="mt-1 text-sm font-medium">{pick(step.title, loc)}</div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft dark:text-zinc-400">{pick(step.desc, loc)}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            {lesson.sourceCompare?.gaps?.length ? (
              <Panel className="mb-5">
                <div className="overflow-hidden rounded-xl border border-line dark:border-zinc-800">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-bg-subtle text-xs uppercase tracking-wide text-ink-faint dark:bg-zinc-900 dark:text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Dimension</th>
                        <th className="px-4 py-3">Teaching</th>
                        <th className="px-4 py-3">Real</th>
                        <th className="px-4 py-3">Why simplified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lesson.sourceCompare.gaps.map((gap, gapIdx) => (
                        <tr key={gapIdx} className="border-t border-line align-top dark:border-zinc-800">
                          <td className="px-4 py-3 font-medium">{pick(gap.dimension, loc)}</td>
                          <td className="px-4 py-3 text-ink-soft dark:text-zinc-300">{pick(gap.simplified, loc)}</td>
                          <td className="px-4 py-3 text-ink-soft dark:text-zinc-300">{pick(gap.real, loc)}</td>
                          <td className="px-4 py-3 text-ink-faint dark:text-zinc-400">{pick(gap.whySimplified, loc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : null}
            {lesson.references.length > 0 && (
              <Panel>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(loc, "lesson.further")}</div>
                <References items={lesson.references} locale={loc} />
              </Panel>
            )}
          </section>

          <section id="practice" className="scroll-mt-28 pt-10">
            <SectionTitle label={t(loc, "lesson.tab.practice")} />
            {lesson.tryIt && (
              <Panel className="mb-5 border-zinc-800 bg-zinc-950 text-zinc-300 dark:bg-zinc-950">
                {lesson.tryIt.setup?.length ? <TryBlock title="Setup" items={lesson.tryIt.setup.map((x) => pick(x, loc))} /> : null}
                <TryBlock title="Commands" items={lesson.tryIt.commands.map((x) => pick(x, loc))} code />
                <TryBlock title="Observe" items={lesson.tryIt.observe.map((x) => pick(x, loc))} />
              </Panel>
            )}
            {lesson.practice?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {lesson.practice.map((task, taskIdx) => (
                  <Panel key={taskIdx}>
                    <div className="font-mono text-[11px] text-ink-faint dark:text-zinc-500">{String(taskIdx + 1).padStart(2, "0")}</div>
                    <h3 className="mt-1 text-base font-semibold">{pick(task.title, loc)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-zinc-300">{pick(task.prompt, loc)}</p>
                    <div className="mt-3 rounded-lg bg-bg-subtle p-3 text-sm dark:bg-zinc-800">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(loc, "lesson.selfCheck")}</div>
                      <p className="text-ink-soft dark:text-zinc-300">{pick(task.check, loc)}</p>
                    </div>
                  </Panel>
                ))}
              </div>
            ) : null}
            {lesson.compare.rows.length > 0 && (
              <div className="mt-6">
                <SectionTitle label={t(loc, "lesson.compare")} />
                <CompareTable rows={lesson.compare.rows} locale={loc} />
              </div>
            )}
            {(lesson.whatsNext || next) && (
              <Panel className="mt-6">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(loc, "lesson.whatsNext")}</div>
                {lesson.whatsNext && (
                  <p className="mb-4 text-sm leading-relaxed text-ink-soft dark:text-zinc-300">{pick(lesson.whatsNext, loc)}</p>
                )}
                {next && (
                  <Link href={`/${loc}/c/${repoId}/lessons/${next.id}`} className="group flex items-start gap-3 rounded-lg border border-line bg-bg-subtle p-4 transition hover:border-brand dark:border-zinc-800 dark:bg-zinc-950">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white font-mono text-xs font-semibold text-ink-faint dark:bg-zinc-900 dark:text-zinc-400">{next.id}</span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold group-hover:text-brand">{pick(next.title, loc)}</span>
                      <span className="mt-0.5 line-clamp-2 text-xs text-ink-faint dark:text-zinc-500">{pick(next.theProblem, loc)}</span>
                    </span>
                    <span className="ml-auto self-center text-ink-faint group-hover:text-brand dark:text-zinc-600">→</span>
                  </Link>
                )}
              </Panel>
            )}
          </section>

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

function LessonTabs({ locale }: { locale: Locale }) {
  const tabs = [
    ["learn", t(locale, "lesson.tab.learn")],
    ["simulate", t(locale, "lesson.tab.simulate")],
    ["code", t(locale, "lesson.tab.code")],
    ["source", t(locale, "lesson.tab.source")],
    ["practice", t(locale, "lesson.tab.practice")],
  ] as const;
  return (
    <nav className="sticky top-14 z-20 -mx-5 mt-5 border-b border-line bg-bg/90 px-5 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12" aria-label="Lesson tabs">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-white hover:text-brand dark:text-zinc-300 dark:hover:bg-zinc-900">
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function SimulationPanel({ spec, locale }: { spec: SimulationSpec; locale: Locale }) {
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">{t(locale, "lesson.simulation")}</div>
        <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[11px] text-brand">{spec.kind}</span>
      </div>
      <h3 className="text-lg font-semibold">{pick(spec.title, locale)}</h3>
      <ol className="mt-4 grid gap-3">
        {spec.steps.map((step, idx) => (
          <li key={idx} className="grid gap-3 rounded-lg border border-line bg-bg-subtle p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.2fr)]">
            <span className="font-mono text-xs font-semibold text-brand">{String(idx + 1).padStart(2, "0")}</span>
            <div>
              <div className="text-sm font-semibold">{pick(step.label, locale)}</div>
              <div className="mt-1 font-mono text-[11px] text-ink-faint dark:text-zinc-500">{pick(step.state, locale)}</div>
            </div>
            <p className="text-sm leading-relaxed text-ink-soft dark:text-zinc-300">{pick(step.detail, locale)}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function SectionTitle({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <h2 className={`mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${accent ? "text-brand" : "text-ink-faint dark:text-zinc-500"}`}>
      <span className="h-px w-5 bg-current opacity-50" />{label}
    </h2>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>{children}</div>;
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
    <div className="mb-4 last:mb-0">
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
