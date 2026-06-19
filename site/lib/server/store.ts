import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Course } from "repo2learn/src/types";

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
  try {
    return JSON.parse(await readFile(join(COURSES_DIR, repoId, "course.json"), "utf8")) as Course;
  } catch {
    return null;
  }
}

export async function getMeta(repoId: string): Promise<CourseMeta | null> {
  try {
    return JSON.parse(await readFile(join(COURSES_DIR, repoId, "meta.json"), "utf8")) as CourseMeta;
  } catch {
    return null;
  }
}

export async function listCourses(): Promise<CourseMeta[]> {
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
