import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { LangSetter } from "@/components/LangSetter";
import { course, pick } from "@/lib/content";
import type { Locale } from "@/lib/types";

const VALID: Locale[] = ["en", "zh"];

export function generateStaticParams() {
  return VALID.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc: Locale = VALID.includes(locale as Locale) ? (locale as Locale) : "en";

  return (
    <div className="min-h-screen">
      <LangSetter locale={loc} />
      <TopBar title={pick(course.outline.course.title, loc)} locale={loc} />
      <div className="mx-auto flex w-full max-w-[1280px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-line p-4 dark:border-zinc-800 lg:block">
          <Sidebar locale={loc} lessons={course.outline.lessons} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
