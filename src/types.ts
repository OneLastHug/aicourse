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

/* ============================ Repo context (Stage 0) ============================ */
export interface RepoContext {
  url: string;
  localPath: string;
  sha: string;
  name: string;
  defaultBranch: string;
  summary: string; // README-derived summary; the architect refines it
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
  /** Optional "before" snippet for before/after comparisons. */
  before?: string;
}
export interface HowItWorksStep {
  title: Bi;
  desc: Bi;
  code?: CodeBlock;
  /** Optional before-snippet (alternative to code.before). */
  beforeCode?: CodeBlock;
  /** Line-by-line anatomy notes (deep mode). */
  anatomy?: Bi;
}
export interface CompareRow { label: Bi; a: string; b: string; }
export interface Reference { title: string; url: string; }

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
export interface OutlineSection {
  id: string;
  title: Bi;
  summary: Bi;
  lessons: OutlineLesson[];
}
export interface Outline {
  course: { title: Bi; tagline: Bi; repo: { url: string; name: string; sha: string }; spine?: Bi };
  sections: OutlineSection[];
  /** Flattened lessons across all sections (backward-compat for the site). */
  lessons: OutlineLesson[];
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
export interface Course { outline: Outline; lessons: Record<string, Lesson>; }

/* ===================== Chinese (primary generation) types ===================== */
export interface ZhOutlineLesson {
  id: string;
  title: string;
  difficulty: Difficulty;
  theProblem: string;
  objective: string;
  mechanism: string; // one-line: the single mechanism this lesson teaches
  filesToRead: string[]; // real paths the lesson agent must read in full
  prereq: string[];
  tags: string[];
}
export interface ZhOutlineSection {
  id: string; // e.g. "layer-1"
  title: string;
  summary: string;
  /** How this layer advances the running example spine. */
  spine: string;
  lessons: ZhOutlineLesson[];
}
export interface ZhOutline {
  course: { title: string; tagline: string; repo: { url: string; name: string; sha: string }; spine: string };
  sections: ZhOutlineSection[];
}
export interface ZhCode { file: string; language: string; snippet: string; highlightLines: number[]; before?: string; }
export interface ZhStep {
  title: string;
  desc: string;
  code?: ZhCode;
  beforeCode?: ZhCode;
  anatomy?: string;
}
export interface ZhLesson {
  id: string;
  problem: string;
  howItWorks: ZhStep[];
  deepDive: string;
  references: Reference[];
  compare: { rows: { label: string; a: string; b: string }[] };
  loc: number;
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
  /** Context window explicitly requested via `-c model_context_window=<n>` (1m = 1000000). */
  contextWindow: number;
  reasoningEffort: string;
  concurrency: number;
  timeoutMs: number;
  extraArgs: string[];
}
export interface Repo2LearnConfig {
  codex: CodexConfig;
  languages: ("zh" | "en")[];
  targetLessonCount: number;
  siteContentDir: string;
  cacheDir: string;
  workDir: string;
  useMock: boolean;
  noCache: boolean;
  repo: string;
  /** Run the validation + fix loop. */
  validate: boolean;
  /** Max validation fix iterations (0 = no fix loop, just report). */
  maxFixRounds: number;
}

export const DEFAULT_CONFIG: Repo2LearnConfig = {
  codex: {
    binary: "codex", model: "gpt-5.4", reasoningEffort: "xhigh",
    contextWindow: 1_000_000,
    concurrency: 10, timeoutMs: 300 * 60 * 1000, extraArgs: [],
  },
  languages: ["zh", "en"],
  targetLessonCount: 10,
  siteContentDir: "site/content/generated",
  cacheDir: ".repo2learn/cache",
  workDir: ".repo2learn/repos",
  useMock: false,
  noCache: false,
  repo: "",
  validate: true,
  maxFixRounds: 1,
};

/** Structured progress event streamed to the web client during generation. */
export type ProgressEvent =
  | { type: "stage"; stage: "ingest" | "analyze" | "curriculum" | "lessons" | "validate1" | "validate2" | "translate" | "render" | "done"; label?: string }
  | { type: "plan"; total: number; lessons: { id: string; title: { zh: string; en: string }; difficulty: Difficulty }[] }
  | { type: "lesson"; id: string; status: "start" | "ok" | "failed"; label?: string }
  | { type: "validation"; round: 1 | 2; passed: boolean; issueCount: number }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "lessonDraft"; id: string; body: unknown }
| { type: "error"; message: string };
