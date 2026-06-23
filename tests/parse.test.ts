import test from "node:test";
import assert from "node:assert/strict";
import { extractJson, assertShape, JsonExtractionError } from "../src/codex/parse";
import { isCourse, isOutline } from "../src/codex/guards";
import { sampleCourse } from "../src/sample/fixtures";

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

/* ---- tolerant repair of JS-object-literal-ish output from the model ---- */

test("tolerates unquoted keys (the production lesson:write failure)", () => {
  const out = extractJson('{ id: "s01", loc: 0 }');
  assert.deepEqual(out, { id: "s01", loc: 0 });
});

test("tolerates single-quoted keys and values", () => {
  const out = extractJson("{ 'id': 's01', 'n': 2 }");
  assert.deepEqual(out, { id: "s01", n: 2 });
});

test("tolerates // and /* */ comments", () => {
  const out = extractJson('{ // header\n "id": "s01" /* trailing */ }');
  assert.deepEqual(out, { id: "s01" });
});

test("tolerates trailing commas", () => {
  const out = extractJson('{ "a": [1, 2, 3,], "b": 4, }');
  assert.deepEqual(out, { a: [1, 2, 3], b: 4 });
});

test("repair never alters code inside double-quoted strings", () => {
  // unquoted key outside, but a snippet that itself contains `key:`, `//`, `,}`, braces
  const out = extractJson('{ snippet: "const o = { a: 1, }; // note\\nif(x){y}" }');
  assert.equal(
    (out as { snippet: string }).snippet,
    "const o = { a: 1, }; // note\nif(x){y}",
  );
});

test("single-quoted value keeps an embedded double quote", () => {
  const out = extractJson("{ 'msg': 'he said \"hi\"' }");
  assert.equal((out as { msg: string }).msg, 'he said "hi"');
});

test("prefers the JSON fence over a leading non-JSON code fence", () => {
  const out = extractJson('```ts\nconst x = 1\n```\nthen:\n```json\n{"id":"s01"}\n```');
  assert.deepEqual(out, { id: "s01" });
});

test("sample outline passes the guard", () => {
  assert.equal(isOutline(sampleCourse.outline), true);
});

test("assertShape rejects bad shapes", () => {
  assert.throws(
    () => assertShape({ lessons: "nope" }, isOutline, "outline"),
    JsonExtractionError,
  );
});

test("isCourse accepts the sample translator output", () => {
  assert.equal(isCourse(sampleCourse), true);
});

test("isCourse rejects the shapes that crashed translate (missing outline/sections)", () => {
  // Before the guard, flattenOutline read `course.outline.sections` directly and threw
  // "Cannot read properties of undefined (reading 'sections')" when the model omitted outline.
  assert.equal(isCourse({ lessons: {} }), false);                          // no outline
  assert.equal(isCourse({ outline: null, lessons: {} }), false);           // null outline
  assert.equal(isCourse({ outline: { course: {} }, lessons: {} }), false); // outline without sections
});

test("assertShape rejects bad translator output as a translate failure", () => {
  assert.throws(
    () => assertShape({ lessons: {} }, isCourse, "translate"),
    JsonExtractionError,
  );
});
