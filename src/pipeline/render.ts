import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Course, Repo2LearnConfig } from "../types";
import { log } from "../util/log";

/**
 * Stage 3 — render the assembled Course into data files the Next.js site reads.
 * The site imports from site/content/generated/. We write one canonical
 * course.json (the full Course) plus a lightweight index.json (sidebar/SEO).
 */
export async function runRenderStage(args: {
  course: Course;
  cfg: Repo2LearnConfig;
}): Promise<string> {
  const { course, cfg } = args;
  const outDir = cfg.siteContentDir;
  await mkdir(outDir, { recursive: true });

  await writeJson(join(outDir, "course.json"), course);

  const index = {
    title: course.outline.course.title,
    tagline: course.outline.course.tagline,
    repo: course.outline.course.repo,
    lessonCount: course.outline.lessons.length,
    lessons: course.outline.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      difficulty: l.difficulty,
      status: course.lessons[l.id]?.status ?? "failed",
    })),
  };
  await writeJson(join(outDir, "index.json"), index);

  log.ok(`render: wrote course.json + index.json → ${outDir}`);
  return outDir;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}
