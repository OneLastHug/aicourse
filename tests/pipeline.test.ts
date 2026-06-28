import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../src/config";
import { MockCodexDriver } from "../src/codex/mock-driver";
import { sampleResponder } from "../src/sample/responder";
import { sampleZhLessons } from "../src/sample/fixtures";
import { runPipeline } from "../src/pipeline/run";

const here = path.dirname(fileURLToPath(import.meta.url));

test("v2 pipeline runs end-to-end (mock): analyze→curriculum→lessons→validate→translate", async () => {
  const cfg = resolveConfig({ useMock: true });
  cfg.cacheDir = path.resolve(here, "..", ".repo2learn/cache-test-v2");
  cfg.workDir = path.resolve(here, "..", ".repo2learn/repos-test-v2");
  const driver = new MockCodexDriver({ responder: sampleResponder, delayMs: 1 });
  const course = await runPipeline({ cfg, driver });

  // layered outline
  assert.ok(course.outline.sections.length >= 1, "has sections");
  assert.ok(course.outline.sections[0]!.lessons.length >= 1, "section has lessons");
  // flat (site-compat) view
  assert.ok(course.outline.lessons.length >= 1, "flattened lessons present");
  // bilingual bodies
  const ids = Object.keys(course.lessons);
  assert.ok(ids.length >= 1, "has lesson bodies");
  const l0 = course.lessons[ids[0]!];
  assert.equal(typeof l0.problem.zh, "string");
  assert.equal(typeof l0.problem.en, "string");
  assert.ok(l0.howItWorks.length >= 1, "lesson has steps");
  // Chinese-first: zh is the original generated text, en is translated from it
  assert.equal(course.lessons["s01"]!.problem.zh, sampleZhLessons.s01!.problem, "zh is the original Chinese");

  assert.ok(course.outline.course.thesis?.zh, "course thesis exists");
  assert.ok(course.outline.course.spine?.zh, "course spine exists");
  assert.ok(course.outline.course.whyThisOrder?.zh, "course whyThisOrder exists");

  const section = course.outline.sections[0]!;
  assert.ok(section.role?.zh, "section role exists");
  assert.ok(section.transitionIn?.zh, "section transitionIn exists");
  assert.ok(section.transitionOut?.zh, "section transitionOut exists");

  const meta = course.outline.lessons[0]!;
  assert.ok(meta.mechanism?.zh, "lesson mechanism exists");
  assert.ok(meta.whyNow?.zh, "lesson whyNow exists");
  assert.ok(meta.nextPressure?.zh, "lesson nextPressure exists");

  const lesson = course.lessons["s01"]!;
  assert.ok(lesson.teachingScope?.zh, "teachingScope exists");
  assert.ok(lesson.whatsNext?.zh, "whatsNext exists");
  assert.ok(Array.isArray(lesson.tryIt?.commands), "tryIt.commands exists");
  assert.ok(Array.isArray(lesson.tryIt?.observe), "tryIt.observe exists");
  assert.ok(Array.isArray(lesson.sourceCompare?.gaps), "sourceCompare.gaps exists");
  assert.ok((lesson.sourceCompare?.gaps?.length ?? 0) >= 1, "sourceCompare has gaps");
  assert.ok(lesson.references[0]?.kind, "reference kind exists");
  assert.ok(lesson.references[0]?.whyUsed, "reference whyUsed exists");
});
