import type { CodexDriver } from "../codex/driver";
import { assertShape, extractJson } from "../codex/parse";
import { log } from "../util/log";

/** Run codex, extract strict JSON, validate shape; retry once on failure. */
export async function codexJson<T>(args: {
  driver: CodexDriver; label: string; prompt: string; cwd: string;
  guard: (v: unknown) => v is T; name: string; attempts?: number;
}): Promise<T> {
  const { driver, label, prompt, cwd, guard, name, attempts = 2 } = args;
  let lastErr: unknown;
  for (let a = 1; a <= attempts; a++) {
    try {
      const res = await driver.run({ label, prompt, cwd });
      return assertShape(extractJson<unknown>(res.text), guard, name);
    } catch (e) { lastErr = e; log.warn(`${label} attempt ${a} failed: ${(e as Error).message}`); }
  }
  throw new Error(`${label} failed: ${(lastErr as Error).message}`);
}
