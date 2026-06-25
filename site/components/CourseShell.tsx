import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { LangSetter } from "./LangSetter";
import { pick } from "@/lib/content";
import type { Course, Locale } from "@/lib/types";

export function CourseShell({
  course,
  locale,
  repoId,
  activeId,
  children,
}: {
  course: Course;
  locale: Locale;
  repoId: string;
  activeId?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <LangSetter locale={locale} />
      <TopBar title={pick(course.outline.course.title, locale)} locale={locale} />
      <div className="mx-auto flex w-full max-w-[1280px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-line p-4 dark:border-zinc-800 lg:block">
          <Sidebar locale={locale} repoId={repoId} lessons={course.outline.lessons} sections={course.outline.sections} activeId={activeId} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
