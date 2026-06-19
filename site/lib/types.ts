/** Site-side view of the Repo2Learn data contract (mirrors src/types.ts). */

export interface Bi {
  zh: string;
  en: string;
}
export type Locale = "zh" | "en";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface OutlineLesson {
  id: string;
  title: Bi;
  difficulty: Difficulty;
  theProblem: Bi;
  objective: Bi;
  keyFiles: string[];
  prereq: string[];
  tags: string[];
}

export interface Outline {
  course: {
    title: Bi;
    tagline: Bi;
    repo: { url: string; name: string; sha: string };
  };
  lessons: OutlineLesson[];
}

export interface CodeBlock {
  file: string;
  language: string;
  snippet: string;
  highlightLines: number[];
}

export interface HowItWorksStep {
  title: Bi;
  desc: Bi;
  code?: CodeBlock;
}

export interface CompareRow {
  label: Bi;
  a: string;
  b: string;
}

export interface Reference {
  title: string;
  url: string;
}

export interface Lesson {
  id: string;
  problem: Bi;
  howItWorks: HowItWorksStep[];
  deepDive: Bi;
  references: Reference[];
  compare: { rows: CompareRow[] };
  loc: number;
  status: "ok" | "failed";
  error?: string;
}

export interface Course {
  outline: Outline;
  lessons: Record<string, Lesson>;
}
