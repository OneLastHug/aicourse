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
  mechanism?: Bi;
  whyNow?: Bi;
  missingBefore?: Bi;
  nextPressure?: Bi;
  keyFiles: string[];
  prereq: string[];
  tags: string[];
}

export interface OutlineSection {
  id: string;
  title: Bi;
  summary: Bi;
  spine?: Bi;
  role?: Bi;
  transitionIn?: Bi;
  transitionOut?: Bi;
  lessons: OutlineLesson[];
}

/** Mermaid diagram — diagram text is language-neutral, only caption is bilingual. */
export interface Diagram { kind: "mermaid"; caption: Bi; diagram: string; }

/** Runnable teaching-code snapshot that grows one mechanism per lesson. */
export interface SpineArtifact {
  lessonId: string;
  path: string;
  language: string;
  code: string;
  runCmd?: string;
  addedLines?: number[];
  prevLessonId?: string;
}

/** Per-lesson badges (concepts are language-neutral tech tags). */
export interface LessonBadges { loc: number; difficulty: Difficulty; concepts: string[]; }

export interface TryIt {
  setup?: Bi[];
  commands: Bi[];
  observe: Bi[];
}

export interface Reference {
  title: string;
  url: string;
  kind?: "official" | "spec" | "paper" | "blog" | "other";
  whyUsed?: Bi;
}

export interface SourceCompareGap {
  dimension: Bi;
  simplified: Bi;
  real: Bi;
  whySimplified: Bi;
}
export interface SourceCompare {
  simplified?: Bi;
  real?: Bi;
  gaps: SourceCompareGap[];
}

export interface Outline {
  course: {
    title: Bi;
    tagline: Bi;
    repo: { url: string; name: string; sha: string };
    spine?: Bi;
    thesis?: Bi;
    audience?: Bi;
    whyThisOrder?: Bi;
  };
  archDiagram?: Diagram;
  sections?: OutlineSection[];
  lessons: OutlineLesson[];
}

export interface CodeBlock {
  file: string;
  language: string;
  snippet: string;
  highlightLines: number[];
  before?: string;
  isSpine?: boolean;
  symbol?: string;
}

export interface HowItWorksStep {
  title: Bi;
  desc: Bi;
  code?: CodeBlock;
  beforeCode?: CodeBlock;
  anatomy?: Bi;
}

export interface CompareRow {
  label: Bi;
  a: string;
  b: string;
}

export interface Lesson {
  id: string;
  principle?: Bi;
  teachingScope?: Bi;
  problem: Bi;
  solution?: Bi;
  diagram?: Diagram;
  spine?: SpineArtifact;
  howItWorks: HowItWorksStep[];
  deepDive: Bi;
  deepSource?: Bi;
  sourceCompare?: SourceCompare;
  tryIt?: TryIt;
  whatsNext?: Bi;
  references: Reference[];
  compare: { rows: CompareRow[] };
  loc: number;
  badges?: LessonBadges;
  status: "ok" | "failed";
  error?: string;
}

export interface Course {
  outline: Outline;
  lessons: Record<string, Lesson>;
}

/** Progress event streamed from the server during generation (SSE).
 *  Mirrors the `ProgressEvent` union in src/types.ts — keep them in sync. */
export type ProgressEvent =
  | { type: "stage"; stage: "ingest" | "analyze" | "curriculum" | "spine" | "lessons" | "validate1" | "validate2" | "translate" | "render" | "done"; label?: string }
  | { type: "plan"; total: number; lessons: { id: string; title: { zh: string; en: string }; difficulty: Difficulty }[] }
  | { type: "lesson"; id: string; status: "start" | "ok" | "failed"; label?: string }
  | { type: "spine"; id: string; status: "start" | "ok" | "failed"; label?: string }
  | { type: "validation"; round: 1 | 2; passed: boolean; issueCount: number }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "error"; message: string };
