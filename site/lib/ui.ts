import type { Difficulty } from "@/lib/types";

export interface ColorTheme {
  solid: string;       // bg-{c}-500 (dots, bars)
  chip: string;        // tinted pill (bg-{c}-100 text-{c}-800 dark:...)
  border: string;      // card accent border (hover intensifies)
  text: string;        // text-{c}-600
}

const THEMES: Record<Difficulty, ColorTheme> = {
  beginner: {
    solid: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    border: "border-emerald-500/30 hover:border-emerald-500/60",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  intermediate: {
    solid: "bg-blue-500",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    border: "border-blue-500/30 hover:border-blue-500/60",
    text: "text-blue-600 dark:text-blue-400",
  },
  advanced: {
    solid: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    border: "border-violet-500/30 hover:border-violet-500/60",
    text: "text-violet-600 dark:text-violet-400",
  },
};

export function difficultyTheme(d: Difficulty): ColorTheme {
  return THEMES[d];
}

/** Small dot only (for compact lists). */
export function difficultyColor(d: Difficulty): string {
  return THEMES[d].solid;
}

export function difficultyLabel(d: Difficulty, locale: "zh" | "en"): string {
  if (locale === "zh") return d === "beginner" ? "入门" : d === "intermediate" ? "进阶" : "高阶";
  return d;
}
