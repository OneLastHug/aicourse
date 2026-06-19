import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Repo2LearnConfig } from "../types";

/**
 * Content-addressed cache for stage outputs, keyed on everything that affects
 * codex output (stage, repo sha, prompt body, model config). Enables resume:
 * re-runs skip completed work and only failed/new items are recomputed.
 */
export class Cache {
  constructor(
    private dir: string,
    private enabled: boolean,
  ) {}

  static fromConfig(cfg: Repo2LearnConfig): Cache {
    return new Cache(cfg.cacheDir, !cfg.noCache);
  }

  key(parts: Record<string, unknown>): string {
    const stable = JSON.stringify(parts, Object.keys(parts).sort());
    return createHash("sha256").update(stable).digest("hex").slice(0, 24);
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.enabled) return undefined;
    try {
      const raw = await readFile(this.path(key), "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await mkdir(dirname(this.path(key)), { recursive: true });
    await writeFile(this.path(key), JSON.stringify(value, null, 2), "utf8");
  }

  private path(key: string): string {
    return join(this.dir, `${key}.json`);
  }
}
