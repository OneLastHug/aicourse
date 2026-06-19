import type { Bi, Locale, OutlineLesson } from "./types";

export const locales: Locale[] = ["en", "zh"];

export function pick<T>(bi: { zh: T; en: T }, locale: Locale): T {
  return bi[locale] ?? bi.en;
}

export function neighbors(lessons: OutlineLesson[], id: string) {
  const idx = lessons.findIndex((l) => l.id === id);
  return {
    prev: idx > 0 ? lessons[idx - 1] : undefined,
    next: idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : undefined,
    index: idx,
    total: lessons.length,
  };
}
