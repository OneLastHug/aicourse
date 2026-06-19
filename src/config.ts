import { DEFAULT_CONFIG, type CodexConfig, type Repo2LearnConfig } from "./types";

/** CLI flags / file overrides, all optional, codex overridable field-by-field. */
export type Repo2LearnFlags = Partial<Omit<Repo2LearnConfig, "codex">> & {
  codex?: Partial<CodexConfig>;
};

/**
 * Load and merge configuration: defaults <- config file <- CLI flags.
 * The config file (config/repo2learn.config.ts) is optional; for simplicity
 * we read a JSON file if present, else rely on defaults + flags.
 */
export function resolveConfig(flags: Repo2LearnFlags = {}, fileConfig?: Partial<Repo2LearnConfig>): Repo2LearnConfig {
  const merged: Repo2LearnConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...stripUndefined(flags),
    codex: {
      ...DEFAULT_CONFIG.codex,
      ...(fileConfig?.codex ?? {}),
      ...(flags.codex ?? {}),
    },
  };
  return merged;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "codex") continue;
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/** A stable string representation of the config bits that affect codex output,
 * used in cache keys. */
export function configFingerprint(c: Repo2LearnConfig): string {
  return [c.codex.model, c.codex.reasoningEffort, c.targetLessonCount, c.languages.join(",")].join("|");
}
