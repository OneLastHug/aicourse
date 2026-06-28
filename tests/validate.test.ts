import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { Cache } from "../src/util/cache";
import { validateCorrectness } from "../src/pipeline/validate";
import { sampleZhOutline, sampleZhLessons } from "../src/sample/fixtures";
import type { CodexCall, CodexDriver } from "../src/codex/driver";

class NoopDriver implements CodexDriver {
  kind: "cli" | "mock" = "mock";
  async run(_call: CodexCall) {
    return { text: '{"passed":true,"issues":[],"summary":"ok"}', durationMs: 0 };
  }
}

const cacheDir = path.resolve("/data/project/aicourse/.repo2learn/cache-test-validation");

test("validateCorrectness fails when references exceed maxReferencesPerLesson in limited research mode", async () => {
  const cfg = resolveConfig({
    research: { enabled: true, mode: "limited", maxReferencesPerLesson: 1 },
    noCache: true,
  });
  const zhCourse = {
    outline: sampleZhOutline,
    lessons: {
      s01: {
        ...sampleZhLessons.s01,
        references: [
          { title: "A", url: "https://a.example", kind: "official", whyUsed: "a" },
          { title: "B", url: "https://b.example", kind: "blog", whyUsed: "b" },
        ],
      },
    },
  };

  const res = await validateCorrectness({
    zhCourse,
    driver: new NoopDriver(),
    cfg,
    cache: new Cache(cacheDir, false),
  });

  assert.equal(res.passed, false);
  assert.match(JSON.stringify(res.issues), /max references/i);
});

test("validateCorrectness fails when references use a disallowed source kind", async () => {
  const cfg = resolveConfig({
    research: { enabled: true, mode: "limited", allowedSources: ["official"] },
    noCache: true,
  });
  const zhCourse = {
    outline: sampleZhOutline,
    lessons: {
      s01: {
        ...sampleZhLessons.s01,
        references: [{ title: "A", url: "https://a.example", kind: "blog", whyUsed: "a" }],
      },
    },
  };

  const res = await validateCorrectness({
    zhCourse,
    driver: new NoopDriver(),
    cfg,
    cache: new Cache(cacheDir, false),
  });

  assert.equal(res.passed, false);
  assert.match(JSON.stringify(res.issues), /disallowed source|allowed source/i);
});

test("validateCorrectness fails when limited research references omit whyUsed or tryIt is unstructured", async () => {
  const cfg = resolveConfig({
    research: { enabled: true, mode: "limited" },
    noCache: true,
  });
  const zhCourse = {
    outline: sampleZhOutline,
    lessons: {
      s01: {
        ...sampleZhLessons.s01,
        references: [{ title: "A", url: "https://a.example", kind: "official", whyUsed: "" }],
        tryIt: { commands: [], observe: ["watch"] },
      },
    },
  };

  const res = await validateCorrectness({
    zhCourse,
    driver: new NoopDriver(),
    cfg,
    cache: new Cache(cacheDir, false),
  });

  assert.equal(res.passed, false);
  assert.match(JSON.stringify(res.issues), /whyUsed|tryIt/i);
});
