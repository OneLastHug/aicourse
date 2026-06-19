import type { Course, Repo2LearnConfig } from "../types";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { ingestRepo } from "../util/repo";
import { runOutlineStage } from "./outline";
import { runContentStage, assembleCourse } from "./content";
import { runRenderStage } from "./render";
import { log } from "../util/log";

/** The end-to-end pipeline. Stages are cached individually for resume. */
export async function runPipeline(args: {
  cfg: Repo2LearnConfig;
  driver: CodexDriver;
}): Promise<Course> {
  const { cfg, driver } = args;
  const cache = Cache.fromConfig(cfg);

  log.stage("Stage 0 · repo ingest");
  const ctx = await ingestRepo(cfg.repo, cfg.workDir);

  log.stage("Stage 1 · layered outline (architect)");
  const outline = await runOutlineStage({ ctx, driver, cfg, cache });

  log.stage("Stage 2 · fill lessons (concurrent sub-agents)");
  const lessons = await runContentStage({ ctx, outline, driver, cfg, cache });
  const course = assembleCourse(outline, lessons);

  log.stage("Stage 3 · render site data");
  await runRenderStage({ course, cfg });

  const ok = Object.values(lessons).filter((l) => l.status === "ok").length;
  log.stage(`Done · ${ok}/${outline.lessons.length} lessons · repo ${ctx.name}@${ctx.sha}`);
  return course;
}
