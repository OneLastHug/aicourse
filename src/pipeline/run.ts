import { rm } from "node:fs/promises";
import type { Course, ProgressEvent, Repo2LearnConfig } from "../types";
import type { CodexDriver } from "../codex/driver";
import { Cache } from "../util/cache";
import { ingestRepo } from "../util/repo";
import { sampleCtx } from "../sample/fixtures";
import { runAnalyzeStage } from "./analyze";
import { runCurriculumStage, flatEnLessons } from "./curriculum";
import { runLessonStages } from "./lesson";
import { validateCorrectness, validateAlignment, type EnCourse } from "./validate";
import { runTranslateStage } from "./translate";
import { log } from "../util/log";

/** v2 pipeline: ingest → analyze → curriculum → lessons(2-phase) → validate×2 → translate.
 *  On any failure the cloned repo is removed so no residuals are left. */
export async function runPipeline(args: {
  cfg: Repo2LearnConfig; driver: CodexDriver; onProgress?: (e: ProgressEvent) => void;
}): Promise<Course> {
  const { cfg, driver, onProgress } = args;
  const cache = Cache.fromConfig(cfg);

  onProgress?.({ type: "stage", stage: "ingest", label: "Cloning & mapping the repo" });
  const ctx = cfg.useMock ? sampleCtx : await ingestRepo(cfg.repo, cfg.workDir);

  try {
    onProgress?.({ type: "stage", stage: "analyze", label: "Deep-reading the actual codebase" });
    const analysis = await runAnalyzeStage({ ctx, driver, cfg, cache, onProgress });

    onProgress?.({ type: "stage", stage: "curriculum", label: "Designing the layered curriculum" });
    const outline = await runCurriculumStage({ ctx, analysis, driver, cfg, cache, onProgress });
    const flat = flatEnLessons(outline);
    onProgress?.({ type: "plan", total: flat.length, lessons: flat.map((l) => ({ id: l.id, title: { zh: "", en: l.title }, difficulty: l.difficulty })) });

    onProgress?.({ type: "stage", stage: "lessons", label: `Writing ${flat.length} lessons (2-phase, ≤${cfg.codex.concurrency} concurrent)` });
    const lessons = await runLessonStages({ ctx, outline, driver, cfg, cache, onProgress });
    const enCourse: EnCourse = { outline, lessons };

    if (cfg.validate) {
      onProgress?.({ type: "stage", stage: "validate1", label: "Validation 1 · correctness & poisoning" });
      const r1 = await validateCorrectness({ enCourse, driver, cfg, cache, onProgress });
      onProgress?.({ type: "stage", stage: "validate2", label: "Validation 2 · alignment with the repo" });
      const r2 = await validateAlignment({ ctx, enCourse, driver, cfg, cache, onProgress });
      if (!r1.passed || !r2.passed) {
        log.warn(`validation issues: r1=${r1.issues.length} r2=${r2.issues.length}`);
        onProgress?.({ type: "log", level: "warn", message: `validation found issues (r1:${r1.issues.length} r2:${r2.issues.length})` });
      }
    }

    onProgress?.({ type: "stage", stage: "translate", label: "Translating the validated course to Chinese" });
    const course = await runTranslateStage({ enCourse, driver, cfg, cache, onProgress });
    onProgress?.({ type: "stage", stage: "done", label: "Done" });
    return course;
  } catch (e) {
    if (!cfg.useMock && ctx?.localPath) await rm(ctx.localPath, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}
