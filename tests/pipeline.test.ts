import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../src/config";
import { MockCodexDriver } from "../src/codex/mock-driver";
import { sampleResponder } from "../src/sample/responder";
import { ingestRepo } from "../src/util/repo";
import { Cache } from "../src/util/cache";
import { runOutlineStage } from "../src/pipeline/outline";
import { runContentStage, assembleCourse } from "../src/pipeline/content";

const here = path.dirname(fileURLToPath(import.meta.url));
const sampleRepo = path.resolve(here, "..", "samples", "nano-agent");

test("offline pipeline: ingest -> outline -> content -> assemble", async () => {
  const cfg = resolveConfig({ useMock: true, targetLessonCount: 6 });
  cfg.cacheDir = path.resolve(here, "..", ".repo2learn/cache-test");
  const driver = new MockCodexDriver({ responder: sampleResponder, delayMs: 5 });
  const cache = Cache.fromConfig(cfg);

  const ctx = await ingestRepo(sampleRepo, path.resolve(here, "..", ".repo2learn/repos-test"));
  assert.ok(ctx.loc > 0, "sample repo should have some LOC");

  const outline = await runOutlineStage({ ctx, driver, cfg, cache });
  assert.ok(outline.lessons.length >= 5);
  assert.match(outline.lessons[0]!.id, /^s\d{2}$/);

  const lessons = await runContentStage({ ctx, outline, driver, cfg, cache });
  const course = assembleCourse(outline, lessons);

  const all = Object.values(course.lessons);
  assert.equal(all.every((l) => l.status === "ok"), true, "all lessons filled");
  assert.ok(all.every((l) => l.howItWorks.length > 0), "every lesson has steps");
  assert.ok(all.every((l) => l.loc >= 0));
});
