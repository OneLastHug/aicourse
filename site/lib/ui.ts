import type { Difficulty } from "@/lib/types";

export function difficultyColor(d: Difficulty): string {
  switch (d) {
    case "beginner":
      return "bg-emerald-500";
    case "intermediate":
      return "bg-amber-500";
    case "advanced":
      return "bg-rose-500";
  }
}

export function difficultyLabel(d: Difficulty, locale: "zh" | "en"): string {
  if (locale === "zh") {
    return d === "beginner" ? "入门" : d === "intermediate" ? "进阶" : "高阶";
  }
  return d;
}
