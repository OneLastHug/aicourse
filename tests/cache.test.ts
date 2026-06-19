import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cache } from "../src/util/cache";

async function withCache<T>(fn: (c: Cache) => Promise<T>, enabled = true): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "r2l-cache-"));
  try {
    return await fn(new Cache(dir, enabled));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("cache miss then hit", async () => {
  await withCache(async (c) => {
    const k = c.key({ a: 1 });
    assert.equal(await c.get(k), undefined);
    await c.set(k, { hello: "world" });
    assert.deepEqual(await c.get(k), { hello: "world" });
  });
});

test("disabled cache never returns", async () => {
  await withCache(async (c) => {
    const k = c.key({ a: 1 });
    await c.set(k, { x: 1 });
    assert.equal(await c.get(k), undefined);
  }, false);
});

test("key is stable for same input, differs otherwise", async () => {
  await withCache(async (c) => {
    assert.equal(c.key({ a: 1, b: 2 }), c.key({ b: 2, a: 1 }), "order-independent");
    assert.notEqual(c.key({ a: 1 }), c.key({ a: 2 }));
  });
});
