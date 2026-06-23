import type { RepoContext } from "../types";

/** Stage 1 — a deep technical read of the REAL repository. The agent runs inside
 * the repo and must actually open files (no pre-filtered excerpts). Output: JSON
 * architectural analysis (in Simplified Chinese) used to design the layered curriculum. */
export function analyzePrompt(ctx: RepoContext): string {
  const fileList = ctx.tree.slice(0, 800).join("\n");
  const langs = Object.entries(ctx.languages).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ");
  return `You are a principal engineer doing a DEEP technical read of a real repository, to prepare a layered tutorial. You are running INSIDE the repo at "${ctx.localPath}".

OPEN AND READ the actual source files with your tools — do not guess from filenames. Search the web for what this project is, its ecosystem, and official docs.

REPO: ${ctx.name} (${ctx.url}) · ${ctx.sha} · ~${ctx.loc} LOC · ${langs}

FILE TREE:
${fileList}

TASK: Explore the codebase thoroughly, then return STRICT JSON ONLY. ALL field VALUES must be in Simplified Chinese (keep JSON keys in English; keep code symbols/paths as-is):
{
  "summary": "<2-4 句中文：这个项目是什么、为何存在>",
  "coreMechanisms": ["<学习者必须理解的关键机制/抽象，按依赖排序，由易到难>"],
  "architecture": "<各部分如何配合：模块、数据与控制流、入口、核心设计决策>",
  "layeredTeachingPath": ["<建议的层次/主题，由易到难，每个是一个连贯分组>"],
  "runningExampleSpine": "<本项目的一个最小版本，可逐课生长，让学习者增量构建>",
  "gotchas": ["<对教学重要的非显而易见的点>"]
}
Ground EVERY claim in files you actually read; cite real paths/symbols. No filler. JSON only, Chinese values.`;
}
