import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Bi, KeyFile, RepoContext } from "../types";
import { log } from "./log";

/**
 * Stage 0 — Repo ingest. Produces a RepoContext from a URL or local path:
 * file tree, language distribution, total LOC, key files + excerpts, sha.
 * Runs locally (no codex).
 */

const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", "target",
  ".repo2learn", "coverage", ".turbo", ".cache", "vendor",
]);
const IGNORED_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".zip", ".gz", ".lock",
]);
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx",
  ".py", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".c", ".h", ".cpp",
  ".cs", ".swift", ".yml", ".yaml", ".toml", ".sh", ".css", ".scss", ".html",
]);

export async function ingestRepo(
  repo: string,
  workDir: string,
): Promise<RepoContext> {
  const isUrl = /^https?:\/\//.test(repo) || /^git@/.test(repo);
  const localPath = isUrl ? await cloneOrPull(repo, workDir) : await resolveLocal(repo);

  const name = deriveName(repo, localPath);
  log.info(`ingesting ${name} from ${localPath}`);
  const tree = await collectTree(localPath);
  const { languages, loc } = await analyze(localPath, tree);
  const keyFiles = await pickKeyFiles(localPath, tree);
  const sha = await gitSha(localPath);
  const readme = await readReadme(localPath);

  const summary: Bi = {
    zh: readme?.zh ?? `这是对仓库 ${name} 的分层解读教程。`,
    en: readme?.en ?? `A layered walkthrough of the ${name} repository.`,
  };

  log.ok(`ingest done · ${tree.length} files · ${loc} LOC · ${Object.keys(languages).length} languages`);
  return { url: repo, localPath, sha, name, defaultBranch: "main", summary, loc, languages, tree, keyFiles };
}

/* ----------------------------- clone / resolve ----------------------------- */

async function cloneOrPull(url: string, workDir: string): Promise<string> {
  await mkdir(workDir, { recursive: true });
  const dir = join(workDir, dirNameForUrl(url));
  const exists = await safeStat(join(dir, ".git"));
  if (exists) {
    await runGit(["pull", "--ff-only"], dir);
    return dir;
  }
  await runGit(["clone", "--depth", "1", url, dir], workDir);
  return dir;
}

async function resolveLocal(path: string): Promise<string> {
  const st = await safeStat(path);
  if (!st || !st.isDirectory()) throw new Error(`repo path not found or not a directory: ${path}`);
  return path;
}

/* --------------------------------- tree ----------------------------------- */

async function collectTree(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) continue;
        await walk(full);
      } else if (e.isFile()) {
        const rel = relative(root, full);
        out.push(rel);
      }
    }
  }
  await walk(root);
  return out.sort();
}

/* --------------------------- language / loc analysis ----------------------- */

function langOf(file: string): string {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
    ".mjs": "JavaScript", ".cjs": "JavaScript", ".py": "Python", ".go": "Go", ".rs": "Rust",
    ".java": "Java", ".kt": "Kotlin", ".rb": "Ruby", ".php": "PHP", ".c": "C", ".h": "C",
    ".cpp": "C++", ".cs": "C#", ".swift": "Swift", ".md": "Markdown", ".mdx": "MDX",
    ".css": "CSS", ".scss": "SCSS", ".html": "HTML", ".json": "JSON", ".yml": "YAML",
    ".yaml": "YAML", ".toml": "TOML", ".sh": "Shell",
  };
  return map[ext] ?? "Other";
}

async function analyze(root: string, tree: string[]): Promise<{ languages: Record<string, number>; loc: number }> {
  const bytes: Record<string, number> = {};
  let loc = 0;
  for (const rel of tree) {
    const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
    if (IGNORED_EXT.has(ext)) continue;
    if (!TEXT_EXT.has(ext) && ext !== "") continue;
    const full = join(root, rel);
    try {
      const content = await readFile(full, "utf8");
      const lang = langOf(rel);
      bytes[lang] = (bytes[lang] ?? 0) + content.length;
      if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"].includes(ext)) {
        loc += content.split("\n").filter((l) => l.trim().length > 0).length;
      }
    } catch {
      // binary or unreadable — skip
    }
  }
  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const languages: Record<string, number> = {};
  for (const [k, v] of Object.entries(bytes)) languages[k] = +(v / total).toFixed(3);
  return { languages, loc };
}

/* -------------------------------- key files ------------------------------- */

const KEYFILE_HINTS = [
  { re: /(^|\/)(index|main|cli|server|app|mod|lib)\.(ts|tsx|js|jsx|py|go|rs)$/, role: "entry" },
  { re: /(package\.json|pyproject\.toml|go\.mod|Cargo\.toml)$/, role: "config" },
  { re: /README/i, role: "docs" },
  { re: /(agent|tool|prompt|route|controller|model|core|engine)\.(ts|tsx|js|py|go|rs)$/, role: "core" },
];

async function pickKeyFiles(root: string, tree: string[]): Promise<KeyFile[]> {
  const scored = tree
    .map((rel) => {
      let score = 0;
      let role = "other";
      for (const h of KEYFILE_HINTS) if (h.re.test(rel)) { score = 2; role = h.role; break; }
      return { rel, score, role };
    })
    .filter((x) => x.score > 0);

  const top = scored.slice(0, 30);
  const out: KeyFile[] = [];
  for (const { rel, role } of top) {
    try {
      const content = await readFile(join(root, rel), "utf8");
      out.push({ path: rel, role, excerpt: content.slice(0, 1600) });
    } catch {
      // skip unreadable
    }
  }
  return out.slice(0, 24);
}

/* --------------------------------- helpers -------------------------------- */

async function readReadme(root: string): Promise<{ zh: string; en: string } | undefined> {
  for (const name of ["README.md", "readme.md", "README.MD", "README"]) {
    try {
      const txt = (await readFile(join(root, name), "utf8")).trim();
      if (!txt) continue;
      const en = txt.slice(0, 500).replace(/\s+/g, " ").trim();
      return { zh: en, en }; // README language fallback; the architect refines it.
    } catch {
      // try next
    }
  }
  return undefined;
}

async function gitSha(root: string): Promise<string> {
  try {
    const out = await runGit(["rev-parse", "--short", "HEAD"], root);
    return out.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const out: string[] = [];
    const err: string[] = [];
    proc.stdout.on("data", (d) => out.push(d.toString()));
    proc.stderr.on("data", (d) => err.push(d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve(out.join("")) : reject(new Error(err.join("").slice(0, 300))),
    );
  });
}

function safeStat(p: string) {
  return stat(p).catch(() => undefined);
}

function deriveName(repo: string, localPath: string): string {
  const base = repo.split(/[\/:]/).filter(Boolean).pop() ?? localPath.split(/[\\/]/).pop() ?? "repo";
  return base.replace(/\.git$/, "");
}

function dirNameForUrl(url: string): string {
  const base = url.split(/[\/:]/).filter(Boolean).pop() ?? "repo";
  return base.replace(/\.git$/, "").replace(/[^a-z0-9_-]+/gi, "-");
}
