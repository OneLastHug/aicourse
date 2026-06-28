import test from "node:test";
import assert from "node:assert/strict";
import { getRunningPct, getStageLabel } from "../site/lib/running-progress";
import { progressScoreForStage } from "../site/lib/server/jobs";

test("running list maps spine stage to label and mid-pipeline percentage", () => {
  const pct = getRunningPct({ stage: "spine", lessonsDone: 0, lessonsTotal: 10 } as any);
  assert.equal(getStageLabel("en", "spine"), "Spine");
  assert.equal(getStageLabel("zh", "spine"), "构建示例代码");
  assert.equal(pct, 20);
});

test("spine progress score sorts after curriculum and before lessons", () => {
  assert.ok(progressScoreForStage("spine", 0) > progressScoreForStage("curriculum", 999));
  assert.ok(progressScoreForStage("spine", 0) < progressScoreForStage("lessons", 0));
});
