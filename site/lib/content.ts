import type { Course, Locale } from "./types";
import courseData from "@/content/generated/course.json";

/** The rendered course (produced by the orchestrator's render stage). */
export const course = courseData as Course;

export const locales: Locale[] = ["en", "zh"];

export function pick<T>(bi: { zh: T; en: T }, locale: Locale): T {
  return bi[locale] ?? bi.en;
}

export const lessons = course.outline.lessons;
export const lessonById = (id: string) => course.lessons[id];

export function neighbors(id: string) {
  const idx = lessons.findIndex((l) => l.id === id);
  return {
    prev: idx > 0 ? lessons[idx - 1] : undefined,
    next: idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : undefined,
    index: idx,
    total: lessons.length,
  };
}
