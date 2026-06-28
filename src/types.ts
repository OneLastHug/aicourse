/**
 * Repo2Learn data contracts (v2 — depth-first, Chinese-first).
 *
 * Generation produces Chinese (Zh*) types → validated → translated to Bi types
 * (the final Course the site renders; zh is the original, en is translated from
 * it). The final Outline carries both `sections` (layered grouping) and a
 * flattened `lessons` (backward-compat for the site).
 */

/** Bilingual string — every user-facing text field in the FINAL output. */
export interface Bi { zh: string; en: string; }
export type Difficulty = "beginner" | "intermediate" | "advanced";

/* ===================== Shared (language-neutral) additions ===================== */
/** Mermaid diagram. The `diagram` text is language-neutral (never translated);
 *  only the caption is bilingual in the final output. */
export interface ZhDiagram { kind: "mermaid"; caption: string; diagram: string; }
export interface Diagram { kind: "mermaid"; caption: Bi; diagram: string; }

/** A runnable teaching-code snapshot that grows one mechanism per lesson
 *  (learn.shareai.run style: sNN/code.<ext>). Language-neutral — passed through
 *  translation unchanged. Each lesson's code is a superset of the previous one. */
export interface SpineArtifact {
  lessonId: string;
  path: string;
  language: string;
  code: string;
  runCmd?: string;
  addedLines?: number[];
  prevLessonId?: string;
}

/** Per-lesson badges. `concepts` are language-neutral tech tags (not translated). */
export interface LessonBadges { loc: number; difficulty: Difficulty; concepts: string[]; }

export interface ZhTryIt {
  setup?: string[];
  commands: string[];
  observe: string[];
}
export interface TryIt {
  setup?: Bi[];
  commands: Bi[];
  observe: Bi[];
}

export interface ZhReference {
  title: string;
  url: string;
  kind?: "official" | "spec" | "paper" | "blog" | "other";
  whyUsed?: string;
}
export interface Reference {
  title: string;
  url: string;
  kind?: "official" | "spec" | "paper" | "blog" | "other";
  whyUsed?: Bi;
}

export interface ZhSourceCompareGap {
  dimension: string;
  simplified: string;
  real: string;
  whySimplified: string;
}
export interface SourceCompareGap {
  dimension: Bi;
  simplified: Bi;
  real: Bi;
  whySimplified: Bi;
}
export interface ZhSourceCompare {
  simplified?: string;
  real?: string;
  gaps: ZhSourceCompareGap[];
}
export interface SourceCompare {
  simplified?: Bi;
  real?: Bi;
  gaps: SourceCompareGap[];
}

/* ============================ Repo context (Stage 0) ============================ */
export interface RepoContext {
  url: string;
  localPath: string;
  sha: string;
  name: string;
  defaultBranch: string;
  summary: string;
  loc: number;
  languages: Record<string, number>;
  tree: string[];
}

/* ===================== Final (bilingual) output — site reads this ===================== */
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
export interface CompareRow { label: Bi; a: string; b: string; }

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
  sections: OutlineSection[];
  lessons: OutlineLesson[];
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
export interface Course { outline: Outline; lessons: Record<string, Lesson>; }

/* ===================== Chinese (primary generation) types ===================== */
export interface ZhOutlineLesson {
  id: string;
  title: string;
  difficulty: Difficulty;
  theProblem: string;
  objective: string;
  mechanism: string;
  whyNow?: string;
  missingBefore?: string;
  nextPressure?: string;
  filesToRead: string[];
  prereq: string[];
  tags: string[];
}
export interface ZhOutlineSection {
  id: string;
  title: string;
  summary: string;
  spine: string;
  role?: string;
  transitionIn?: string;
  transitionOut?: string;
  lessons: ZhOutlineLesson[];
}
export interface ZhOutline {
  course: {
    title: string;
    tagline: string;
    repo: { url: string; name: string; sha: string };
    spine: string;
    thesis?: string;
    audience?: string;
    whyThisOrder?: string;
  };
  archDiagram?: ZhDiagram;
  sections: ZhOutlineSection[];
}
export interface ZhCode { file: string; language: string; snippet: string; highlightLines: number[]; before?: string; isSpine?: boolean; symbol?: string; }
export interface ZhStep {
  title: string;
  desc: string;
  code?: ZhCode;
  beforeCode?: ZhCode;
  anatomy?: string;
}
export interface ZhLesson {
  id: string;
  principle?: string;
  teachingScope?: string;
  problem: string;
  solution?: string;
  diagram?: ZhDiagram;
  spine?: SpineArtifact;
  howItWorks: ZhStep[];
  deepDive: string;
  deepSource?: string;
  sourceCompare?: ZhSourceCompare;
  tryIt?: ZhTryIt;
  whatsNext?: string;
  references: ZhReference[];
  compare: { rows: { label: string; a: string; b: string }[] };
  loc: number;
  badges?: LessonBadges;
  filesUsed: string[];
}

/* ===================== Validation types ===================== */
export interface ValidationIssue {
  severity: "error" | "warning";
  lessonId?: string;
  problem: string;
  fix?: string;
}
export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  summary: string;
}

/* ===================== Config ===================== */
export interface CodexConfig {
  binary: string;
  model: string;
  contextWindow: number;
  reasoningEffort: string;
  concurrency: number;
  timeoutMs: number;
  extraArgs: string[];
}
export interface ResearchConfig {
  enabled: boolean;
  mode: "off" | "limited";
  allowedSources: string[];
  maxReferencesPerLesson: number;
}
export interface Repo2LearnConfig {
  codex: CodexConfig;
  research: ResearchConfig;
  languages: ("zh" | "en")[];
  targetLessonCount: number;
  siteContentDir: string;
  cacheDir: string;
  workDir: string;
  useMock: boolean;
  noCache: boolean;
  repo: string;
  spine: boolean;
  validate: boolean;
  maxFixRounds: number;
}

export const DEFAULT_CONFIG: Repo2LearnConfig = {
  codex: {
    binary: "codex", model: "gpt-5.4", reasoningEffort: "xhigh",
    contextWindow: 1_000_000,
    concurrency: 10, timeoutMs: 300 * 60 * 1000, extraArgs: [],
  },
  research: {
    enabled: false,
    mode: "off",
    allowedSources: ["official", "spec", "paper", "blog"],
    maxReferencesPerLesson: 3,
  },
  languages: ["zh", "en"],
  targetLessonCount: 10,
  siteContentDir: "site/content/generated",
  cacheDir: ".repo2learn/cache",
  workDir: ".repo2learn/repos",
  useMock: false,
  noCache: false,
  repo: "",
  spine: true,
  validate: true,
  maxFixRounds: 1,
};

/** Structured progress event streamed to the web client during generation. */
export type ProgressEvent =
  | { type: "stage"; stage: "ingest" | "analyze" | "curriculum" | "spine" | "lessons" | "validate1" | "validate2" | "translate" | "render" | "done"; label?: string }
  | { type: "plan"; total: number; lessons: { id: string; title: { zh: string; en: string }; difficulty: Difficulty }[] }
  | { type: "lesson"; id: string; status: "start" | "ok" | "failed"; label?: string }
  | { type: "spine"; id: string; status: "start" | "ok" | "failed"; label?: string }
  | { type: "validation"; round: 1 | 2; passed: boolean; issueCount: number }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "lessonDraft"; id: string; body: unknown }
  | { type: "error"; message: string };
