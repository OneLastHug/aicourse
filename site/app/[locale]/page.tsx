import Link from "next/link";
import { listCourses } from "@/lib/server/store";
import { TopBar } from "@/components/TopBar";
import { HomeForm } from "@/components/HomeForm";
import { RunningList } from "@/components/RunningList";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const VALID: Locale[] = ["en", "zh"];
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // read course list from disk per request

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc: Locale = VALID.includes(locale as Locale) ? (locale as Locale) : "en";
  const courses = await listCourses();

  const steps = [
    { n: "01", t: t(loc, "home.step1.t"), d: t(loc, "home.step1.d") },
    { n: "02", t: t(loc, "home.step2.t"), d: t(loc, "home.step2.d") },
    { n: "03", t: t(loc, "home.step3.t"), d: t(loc, "home.step3.d") },
  ];

  return (
    <>
      <TopBar title={t(loc, "brand")} locale={loc} />
      <main className="min-h-screen">
        <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
          <div className="chip mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {t(loc, "home.badge")}
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-ink dark:text-zinc-50 sm:text-5xl lg:text-6xl">
            {t(loc, "home.title")}
          </h1>
          <p className="mt-4 max-w-xl text-balance text-base text-ink-faint dark:text-zinc-400 sm:text-xl">
            {t(loc, "home.subtitle")}
          </p>

          <HomeForm locale={loc} />

          <div className="mt-16 grid w-full max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="card p-4">
                <div className="font-mono text-xs text-brand">{s.n}</div>
                <div className="mt-1 text-sm font-semibold">{s.t}</div>
                <div className="mt-1 text-xs text-ink-faint dark:text-zinc-500">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* In-progress (client-polled, live) */}
        <RunningList locale={loc} />

        {/* Completed tutorials — server-rendered into HTML so every browser sees them */}
        {courses.length > 0 && (
          <section className="mx-auto max-w-2xl px-5 pb-20">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint dark:text-zinc-500">
              {t(loc, "home.completed")}
            </h2>
            <div className="space-y-2">
              {courses.map((c) => (
                <Link key={c.repoId} href={`/${loc}/c/${c.repoId}`} className="card flex items-center gap-3 p-3 transition hover:-translate-y-0.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">✓</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="mt-1 text-[11px] text-ink-faint dark:text-zinc-500">{c.name} · {c.lessonCount} {t(loc, "course.unit")}</div>
                  </div>
                  <span className="text-xs font-medium text-brand">{t(loc, "home.openCourse")} →</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
