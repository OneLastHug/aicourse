import test from "node:test";
import assert from "node:assert/strict";
import { createLimiter } from "../src/util/concurrency";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test("limiter caps concurrency at n", async () => {
  const N = 5;
  const lim = createLimiter(N);
  let active = 0;
  let max = 0;

  const task = async () => {
    active++;
    max = Math.max(max, active);
    await sleep(6);
    active--;
  };

  await Promise.all(Array.from({ length: 25 }, () => lim(task)));
  assert.equal(max, N, `peak concurrency should be ${N}`);
  assert.equal(active, 0);
});

test("limiter preserves results and order of resolution", async () => {
  const lim = createLimiter(2);
  const out = await Promise.all(
    [1, 2, 3, 4].map((i) => lim(async () => i * 10)),
  );
  assert.deepEqual(out, [10, 20, 30, 40]);
});

test("limiter rejects when n < 1", () => {
  assert.throws(() => createLimiter(0));
  assert.throws(() => createLimiter(-1));
});

test("limiter surfaces task rejections", async () => {
  const lim = createLimiter(1);
  await assert.rejects(() => lim(async () => { throw new Error("boom"); }), /boom/);
});
