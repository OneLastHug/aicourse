import type {
  Course,
  Lesson,
  Outline,
  OutlineLesson,
  Repo2LearnConfig,
  RepoContext,
} from "../types";
import { lessonPrompt } from "../prompts/lesson";
import type { CodexDriver } from "../codex/driver";
import { assertShape, extractJson } from "../codex/parse";
import { isLesson } from "../codex/guards";
import { Cache } from "../util/cache";
import { createLimiter } from "../util/concurrency";
import { configFingerprint } from "../config";
import { log } from "../util/log";

/**
 * Stage 2 — fill each lesson with a concurrent codex sub-agent.
 * Concurrency is capped at cfg.codex.concurrency (the user specified 5).
 * Per-lesson failures are isolated: retried once, then marked failed so the
 * rest of the course still renders (and resume can re-run just these).
 */
export async function runContentStage(args: {
  ctx: RepoContext;
  outline: Outline;
  driver: CodexDriver;
  cfg: Repo2LearnConfig;
  cache: Cache;
}): Promise<Record<string, Lesson>> {
  const { ctx, outline, driver, cfg, cache } = args;
  const limit = createLimiter(cfg.codex.concurrency);
  log.stage(`Stage 2 · filling ${outline.lessons.length} lessons (concurrency ${cfg.codex.concurrency})`);

  const titles = outline.lessons.map((l) => `${l.id} ${l.title.en}`).join("\n");
  const results = await Promise.all(
    outline.lessons.map((lesson) => limit(() => fillLesson({ lesson, ctx, outline, driver, cfg, cache, titles }))),
  );

  const map: Record<string, Lesson> = {};
  for (const r of results) map[r.id] = r;

  const ok = results.filter((r) => r.status === "ok").length;
  log.ok(`content: ${ok}/${results.length} lessons filled`);
  return map;
}

async function fillLesson(args: {
  lesson: OutlineLesson;
  ctx: RepoContext;
  outline: Outline;
  driver: CodexDriver;
  cfg: Repo2LearnConfig;
  cache: Cache;
  titles: string;
}): Promise<Lesson> {
  const { lesson, ctx, driver, cfg, cache, titles } = args;
  const key = cache.key({
    stage: "lesson",
    sha: ctx.sha,
    id: lesson.id,
    cfg: configFingerprint(cfg),
    promptVersion: 2,
  });

  const cached = await cache.get<Lesson>(key);
  if (cached) {
    log.step(`lesson ${lesson.id}: cache hit`);
    return cached;
  }

  const prompt = lessonPrompt(ctx, lesson, titles);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await driver.run({ label: `lesson:${lesson.id}`, prompt, cwd: ctx.localPath });
      const parsed = extractJson<unknown>(res.text);
      const lessonOut = assertShape(parsed, isLesson, `lesson ${lesson.id}`);
      lessonOut.status = "ok";
      await cache.set(key, lessonOut);
      log.step(`lesson ${lesson.id}: ok (${res.durationMs}ms)`);
      return lessonOut;
    } catch (e) {
      log.warn(`lesson ${lesson.id} attempt ${attempt} failed: ${(e as Error).message}`);
    }
  }

  const failed: Lesson = {
    id: lesson.id,
    problem: lesson.theProblem,
    howItWorks: [],
    deepDive: { zh: "（生成失败，可用 --no-cache 重试）", en: "(generation failed; retry with --no-cache)" },
    references: [],
    compare: { rows: [] },
    loc: 0,
    status: "failed",
    error: "both attempts failed",
  };
  return failed;
}

/** Assemble outline + lessons into a render-ready Course. */
export function assembleCourse(outline: Outline, lessons: Record<string, Lesson>): Course {
  return { outline, lessons };
}
