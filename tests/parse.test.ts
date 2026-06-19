import test from "node:test";
import assert from "node:assert/strict";
import { extractJson, assertShape, JsonExtractionError } from "../src/codex/parse";
import { isOutline } from "../src/codex/guards";
import { sampleOutline } from "../src/sample/fixtures";

test("extracts bare JSON object", () => {
  const out = extractJson('{"a":1,"b":[2,3]}');
  assert.deepEqual(out, { a: 1, b: [2, 3] });
});

test("extracts JSON wrapped in markdown fences", () => {
  const out = extractJson('Here you go:\n```json\n{"x":"y"}\n```\n');
  assert.deepEqual(out, { x: "y" });
});

test("extracts JSON after leading prose", () => {
  const out = extractJson('Sure! Here is the plan:\n\n{"id":"s01"}');
  assert.deepEqual(out, { id: "s01" });
});

test("extracts array", () => {
  const out = extractJson('noise [1, 2, {"k":true}] trailing');
  assert.deepEqual(out, [1, 2, { k: true }]);
});

test("handles braces inside strings", () => {
  const out = extractJson('{"code":"if (x) { y }"}');
  assert.equal((out as { code: string }).code, "if (x) { y }");
});

test("throws on missing JSON", () => {
  assert.throws(() => extractJson("no json here at all"), JsonExtractionError);
});

test("sample outline passes the guard", () => {
  assert.equal(isOutline(sampleOutline), true);
});

test("assertShape rejects bad shapes", () => {
  assert.throws(
    () => assertShape({ lessons: "nope" }, isOutline, "outline"),
    JsonExtractionError,
  );
});
