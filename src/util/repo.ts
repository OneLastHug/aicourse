import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { RepoContext } from "../types";
import { log } from "./log";

/** Stage 0 — Repo ingest. Clones/updates the repo and gathers the file tree +
 * metadata. Deliberately does NOT pre-filter "key files" or excerpt them — codex
 * reads the real files itself during analyze/lesson stages. */

const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", "target",
  ".repo2learn", "coverage", ".turbo", ".cache", "vendor", ".venv", "venv",
]);

export async function ingestRepo(repo: string, workDir: string): Promise<RepoContext> {
  const isUrl = /^https?:\/\//.test(repo) || /^git@/.test(repo);
  const localPath = isUrl ? await cloneOrPull(repo, workDir) : await resolveLocal(repo);
  const name = deriveName(repo, localPath);
  log.info(`ingesting ${name} from ${localPath}`);
  const tree = await collectTree(localPath);
  const { languages, loc } = await analyze(localPath, tree);
  const sha = await gitSha(localPath);
  const summary = await readReadme(localPath);
  log.ok(`ingest done · ${tree.length} files · ${loc} LOC · ${Object.keys(languages).length} languages`);
  return { url: repo, localPath, sha, name, defaultBranch: "main", summary, loc, languages, tree };
}

async function cloneOrPull(url: string, workDir: string): Promise<string> {
  await mkdir(workDir, { recursive: true });
  const dir = join(workDir, dirNameForUrl(url));
  const exists = await safeStat(join(dir, ".git"));
  if (exists) { await runGit(["pull", "--ff-only"], dir); return dir; }
  await runGit(["clone", "--depth", "1", url, dir], workDir);
  return dir;
}
async function resolveLocal(path: string): Promise<string> {
  const st = await safeStat(path);
  if (!st || !st.isDirectory()) throw new Error(`repo path not found or not a directory: ${path}`);
  return path;
}
async function collectTree(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (!IGNORED_DIRS.has(e.name)) await walk(full); }
      else if (e.isFile()) { out.push(relative(root, full)); }
    }
  }
  await walk(root);
  return out.sort();
}
function langOf(file: string): string {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".ts":"TypeScript",".tsx":"TypeScript",".js":"JavaScript",".jsx":"JavaScript",".mjs":"JavaScript",".cjs":"JavaScript",
    ".py":"Python",".go":"Go",".rs":"Rust",".java":"Java",".kt":"Kotlin",".rb":"Ruby",".php":"PHP",".c":"C",".h":"C",
    ".cpp":"C++",".cs":"C#",".swift":"Swift",".md":"Markdown",".mdx":"MDX",".css":"CSS",".scss":"SCSS",".html":"HTML",
    ".json":"JSON",".yml":"YAML",".yaml":"YAML",".toml":"TOML",".sh":"Shell",
  };
  return map[ext] ?? "Other";
}
async function analyze(root: string, tree: string[]) {
  const bytes: Record<string, number> = {}; let loc = 0;
  const CODE = new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs",".py",".go",".rs",".java",".kt",".rb",".c",".h",".cpp",".cs",".swift"]);
  for (const rel of tree) {
    const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
    try {
      const content = await readFile(join(root, rel), "utf8");
      bytes[langOf(rel)] = (bytes[langOf(rel)] ?? 0) + content.length;
      if (CODE.has(ext)) loc += content.split("\n").filter((l) => l.trim().length > 0).length;
    } catch {}
  }
  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const languages: Record<string, number> = {};
  for (const [k, v] of Object.entries(bytes)) languages[k] = +(v / total).toFixed(3);
  return { languages, loc };
}
async function readReadme(root: string): Promise<string> {
  for (const name of ["README.md", "readme.md", "README.MD", "README"]) {
    try { return (await readFile(join(root, name), "utf8")).slice(0, 800).replace(/\s+/g, " ").trim(); } catch {}
  }
  return "";
}
async function gitSha(root: string): Promise<string> {
  try { return (await runGit(["rev-parse", "--short", "HEAD"], root)).trim() || "unknown"; } catch { return "unknown"; }
}
function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const out: string[] = [], err: string[] = [];
    p.stdout.on("data", (d) => out.push(d.toString())); p.stderr.on("data", (d) => err.push(d.toString()));
    p.on("error", reject); p.on("close", (c) => c === 0 ? resolve(out.join("")) : reject(new Error(err.join("").slice(0, 300))));
  });
}
const safeStat = (p: string) => stat(p).catch(() => undefined);
function deriveName(repo: string, localPath: string): string {
  const base = repo.split(/[\/:]/).filter(Boolean).pop() ?? localPath.split(/[\\/]/).pop() ?? "repo";
  return base.replace(/\.git$/, "");
}
/** Directory name a repo URL is cloned into under workDir. Exported so the
 *  server can locate (and clean up) a clone without re-deriving the rule. */
export function dirNameForUrl(url: string): string {
  const base = url.split(/[\/:]/).filter(Boolean).pop() ?? "repo";
  return base.replace(/\.git$/, "").replace(/[^a-z0-9_-]+/gi, "-");
}
