import test from "node:test";
import assert from "node:assert/strict";
import { renderStepCodeBlock } from "../site/lib/step-codeblock";

test("renderStepCodeBlock folds title and explanation into wrapped comment lines above the code", () => {
  const out = renderStepCodeBlock({
    title: "会话键",
    description: "这一层把 transport 上来的原始会话映射成稳定 session key，后续 reply 决策与 agent 状态都靠它来串起来，所以解释文字应该进注释里并自动换行，避免从右边溢出。",
    code: "const sessionKey = getSessionKey(frame)\nreply(sessionKey)",
    maxCommentWidth: 26,
  });

  const lines = out.split("\n");
  assert.equal(lines[0], "# 会话键");
  assert.match(out, /^# 这一层把 transport$/m);
  assert.match(out, /^const sessionKey = getSessionKey\(frame\)$/m);
  assert.match(out, /^reply\(sessionKey\)$/m);
  const commentLines = lines.filter((line) => line.startsWith("# "));
  assert.ok(commentLines.every((line) => line.length <= 28), `found overlong comment line: ${commentLines.find((line) => line.length > 28)}`);
});

test("renderStepCodeBlock preserves blank lines inside code while only wrapping comment lines", () => {
  const out = renderStepCodeBlock({
    title: "Reply chain",
    description: "Read hooks before deciding reply output.",
    code: "const pre = hooks.before()\n\nreturn decide(pre)",
    maxCommentWidth: 18,
  });

  assert.equal(out, "# Reply chain\n# Read hooks before\n# deciding reply\n# output.\nconst pre = hooks.before()\n\nreturn decide(pre)");
});
