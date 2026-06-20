import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../src/config";
import { MockCodexDriver } from "../src/codex/mock-driver";
import { sampleResponder } from "../src/sample/responder";
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
});
