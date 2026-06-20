/**
 * Core data contracts for Repo2Learn.
 *
 * The orchestrator produces these structures; the Next.js site consumes only
 * these structures. Keeping them in one place decouples the two layers and
 * makes the whole pipeline unit-testable offline (via a mock codex driver).
 */

/** A bilingual string — every user-facing text field uses this shape. */
export interface Bi {
  zh: string;
  en: string;
}

export type Difficulty = "beginner" | "intermediate" | "advanced";

/* Stage 0 — RepoContext (produced locally, no codex) */
export interface KeyFile {
  path: string;
  role: string;
  excerpt: string;
}

export interface RepoContext {
  url: string;
  localPath: string;
  sha: string;
  name: string;
  defaultBranch: string;
  summary: Bi;
  loc: number;
  languages: Record<string, number>;
  tree: string[];
  keyFiles: KeyFile[];
}

/* Stage 1 — Outline (the layered breakdown s01..sN) */
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

/* Stage 2 — Lesson (filled per-lesson by a concurrent codex sub-agent) */
export interface HowItWorksStep {
  title: Bi;
  desc: Bi;
  code?: {
    file: string;
    language: string;
    snippet: string;
    highlightLines: number[];
  };
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

/** The fully assembled course, ready to render. */
export interface Course {
  outline: Outline;
  lessons: Record<string, Lesson>;
}

/* Config */
export interface CodexConfig {
  binary: string;
  model: string;
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
}

export const DEFAULT_CONFIG: Repo2LearnConfig = {
  codex: {
    binary: "codex",
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    concurrency: 5,
    timeoutMs: 300 * 60 * 1000,  // 300 min per codex call
    extraArgs: [],
  },
  languages: ["zh", "en"],
  targetLessonCount: 10,
  siteContentDir: "site/content/generated",
  cacheDir: ".repo2learn/cache",
  workDir: ".repo2learn/repos",
  useMock: false,
  noCache: false,
  repo: "",
};

/** Structured progress event streamed to the web client during generation. */
export type ProgressEvent =
  | { type: "stage"; stage: "ingest" | "outline" | "content" | "render" | "done"; label?: string }
  | { type: "plan"; total: number; lessons: { id: string; title: Bi; difficulty: Difficulty }[] }
  | { type: "lesson"; id: string; status: "start" | "ok" | "failed"; label?: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "error"; message: string };
