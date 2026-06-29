import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, isAbsolute } from "node:path";
import type { Course } from "repo2learn/src/types";
import { dirNameForUrl } from "repo2learn/src/util/repo";
import { fetchPythonJson } from "./python-backend";

/** All on-disk state lives under one directory (override with R2L_DATA_DIR). */
export const DATA_DIR = process.env.R2L_DATA_DIR || join(process.cwd(), "data");
export const COURSES_DIR = join(DATA_DIR, "courses");
export const WORK_DIR = join(DATA_DIR, "repos");
export const CACHE_DIR = join(DATA_DIR, "cache");

export interface CourseMeta {
  repoId: string;
  url: string;
  name: string;
  title: string;
  createdAt: string;
  lessonCount: number;
}

export function repoIdFor(url: string): string {
  const base = url.split(/[\/:]/).filter(Boolean).pop()?.replace(/\.git$/, "") || "repo";
  const slug = base.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40).toLowerCase().replace(/^-+|-+$/g, "");
  const h = createHash("sha1").update(url).digest("hex").slice(0, 6);
  return `${slug || "repo"}-${h}`;
}

export async function saveCourse(repoId: string, course: Course, meta: CourseMeta): Promise<void> {
  const dir = join(COURSES_DIR, repoId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "course.json"), JSON.stringify(course), "utf8");
  await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
}

export async function getCourse(repoId: string): Promise<Course | null> {
  const remote = await fetchPythonJson<Course>("/api/courses/" + encodeURIComponent(repoId));
  if (remote) return remote;

  try {
    return JSON.parse(await readFile(join(COURSES_DIR, repoId, "course.json"), "utf8")) as Course;
  } catch {
    return null;
  }
}

export async function getMeta(repoId: string): Promise<CourseMeta | null> {
  const course = await fetchPythonJson<Course>("/api/courses/" + encodeURIComponent(repoId));
  if (course) {
    return {
      repoId,
      url: course.outline.course.repo.url,
      name: course.outline.course.repo.name,
      title: course.outline.course.title.en,
      createdAt: new Date().toISOString(),
      lessonCount: course.outline.lessons.length,
    };
  }

  try {
    return JSON.parse(await readFile(join(COURSES_DIR, repoId, "meta.json"), "utf8")) as CourseMeta;
  } catch {
    return null;
  }
}

export async function listCourses(): Promise<CourseMeta[]> {
  const remote = await fetchPythonJson<{ courses: CourseMeta[] }>("/api/courses");
  if (remote?.courses) return remote.courses;

  try {
    const dirs = await readdir(COURSES_DIR, { withFileTypes: true });
    const metas: CourseMeta[] = [];
    for (const d of dirs) {
      if (d.isDirectory()) {
        const m = await getMeta(d.name);
        if (m) metas.push(m);
      }
    }
    return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function removeCourse(repoId: string): Promise<void> {
  await rm(join(COURSES_DIR, repoId), { recursive: true, force: true }).catch(() => {});
}

/** Remove the cloned repo a generation created under WORK_DIR. Used to clean up
 *  after a failed or interrupted job so no residual checkout is left on disk. */
export async function removeRepoClone(repoUrl: string): Promise<void> {
  await rm(join(WORK_DIR, dirNameForUrl(repoUrl)), { recursive: true, force: true }).catch(() => {});
}

/* ----------------------------- job records ------------------------------- */
/* Persisted so the dashboard (running/done/error) survives restarts and is
   visible from every device hitting this server. Completed course DATA lives
   in courses/; this is the job-history index. */

export const JOBS_DIR = join(DATA_DIR, "jobs");

export interface JobRecord {
  id: string;
  repoUrl: string;
  repoId: string;
  status: "running" | "done" | "error";
  stage: string;
  lessonsDone: number;
  lessonsTotal: number;
  repoTitle?: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

export async function saveJobRecord(r: JobRecord): Promise<void> {
  await mkdir(JOBS_DIR, { recursive: true });
  await writeFile(join(JOBS_DIR, r.id + ".json"), JSON.stringify(r, null, 2), "utf8");
}

export async function getJobRecord(id: string): Promise<JobRecord | null> {
  try { return JSON.parse(await readFile(join(JOBS_DIR, id + ".json"), "utf8")) as JobRecord; }
  catch { return null; }
}

export async function removeJobRecord(id: string): Promise<void> {
  await rm(join(JOBS_DIR, id + ".json"), { force: true }).catch(() => {});
}

export async function listJobRecords(): Promise<JobRecord[]> {
  try {
    const entries = await readdir(JOBS_DIR, { withFileTypes: true });
    const out: JobRecord[] = [];
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".json")) {
        try { out.push(JSON.parse(await readFile(join(JOBS_DIR, e.name), "utf8")) as JobRecord); } catch {}
      }
    }
    return out.sort((a, b) => b.startedAt - a.startedAt);
  } catch { return []; }
}

/* Startup diagnostic: make it obvious where data lives + nudge to a persistent path. */
if (process.env.NEXT_RUNTIME === "nodejs") {
  console.log("[repo2learn] data dir:", DATA_DIR);
  if (!isAbsolute(DATA_DIR)) {
    console.warn("[repo2learn] R2L_DATA_DIR is relative — set an absolute persistent path (e.g. /var/lib/aicourse) so tutorials survive redeployments.");
  }
}
