import { t } from "./i18n";
import type { Locale } from "./types";

export type RunningProgressInput = {
  stage: string;
  lessonsDone: number;
  lessonsTotal: number;
};

export function getStageLabel(locale: Locale, stage: string): string {
  const map: Record<string, string> = {
    queued: locale === "zh" ? "排队中" : "queued",
    ingest: t(locale, "stage.ingest"),
    analyze: t(locale, "stage.analyze"),
    curriculum: t(locale, "stage.curriculum"),
    spine: t(locale, "stage.spine"),
    lessons: t(locale, "stage.lessons"),
    validate1: t(locale, "stage.validate1"),
    validate2: t(locale, "stage.validate2"),
    translate: t(locale, "stage.translate"),
    done: t(locale, "stage.done"),
  };
  return map[stage] ?? stage;
}

export function getRunningPct(r: RunningProgressInput): number {
  if (r.stage === "done") return 100;
  if (r.stage === "translate") return 92;
  if (r.stage === "validate2") return 88;
  if (r.stage === "validate1") return 82;
  if (r.stage === "lessons") return r.lessonsTotal > 0 ? 30 + Math.round((r.lessonsDone / r.lessonsTotal) * 45) : 30;
  if (r.stage === "spine") return 20;
  if (r.stage === "curriculum") return 18;
  if (r.stage === "analyze") return 12;
  if (r.stage === "ingest") return 5;
  return 2;
}
