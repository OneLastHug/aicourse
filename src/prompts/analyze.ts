import type { RepoContext } from "../types";

/** Stage 1 — a deep technical read of the REAL repository. The agent runs inside
 * the repo and must actually open files (no pre-filtered excerpts). Output: JSON
 * architectural analysis used to design the layered curriculum. */
export function analyzePrompt(ctx: RepoContext): string {
  const fileList = ctx.tree.slice(0, 800).join("\n");
  const langs = Object.entries(ctx.languages).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ");
  return `You are a principal engineer doing a DEEP technical read of a real repository, to prepare a layered tutorial. You are running INSIDE the repo at "${ctx.localPath}".

OPEN AND READ the actual source files with your tools — do not guess from filenames. Search the web for what this project is, its ecosystem, and official docs.

REPO: ${ctx.name} (${ctx.url}) · ${ctx.sha} · ~${ctx.loc} LOC · ${langs}

FILE TREE:
${fileList}

TASK: Explore the codebase thoroughly, then return STRICT JSON ONLY:
{
  "summary": "<2-4 sentences: what this project is and why it exists>",
  "coreMechanisms": ["<the key mechanisms/abstractions a learner must understand, ordered by dependency, easiest first>"],
  "architecture": "<how the pieces fit: modules, data & control flow, entry points, the central design decision>",
  "layeredTeachingPath": ["<proposed layers/themes, easiest→hardest, each a coherent grouping>"],
  "runningExampleSpine": "<a minimal version of this project that could grow lesson-by-lesson so the learner builds it up incrementally>",
  "gotchas": ["<non-obvious things that matter for teaching it well>"]
}
Ground EVERY claim in files you actually read; cite real paths/symbols. No filler. JSON only.`;
}
