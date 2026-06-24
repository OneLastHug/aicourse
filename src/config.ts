import { DEFAULT_CONFIG, type CodexConfig, type Repo2LearnConfig } from "./types";

/** CLI flags / file overrides, all optional, codex overridable field-by-field. */
export type Repo2LearnFlags = Partial<Omit<Repo2LearnConfig, "codex">> & {
  codex?: Partial<CodexConfig>;
};

/**
 * Load and merge configuration: defaults <- config file <- env <- CLI flags.
 * The config file (config/repo2learn.config.ts) is optional; for simplicity
 * we read a JSON file if present, else rely on defaults + flags. Env knobs
 * (e.g. R2L_VALIDATE) sit between the file and explicit flags.
 */
export function resolveConfig(flags: Repo2LearnFlags = {}, fileConfig?: Partial<Repo2LearnConfig>): Repo2LearnConfig {
  const merged: Repo2LearnConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...stripUndefined(envValidateFlag()),
    ...stripUndefined(envSpineFlag()),
    ...stripUndefined(flags),
    codex: {
      ...DEFAULT_CONFIG.codex,
      ...(fileConfig?.codex ?? {}),
      ...(flags.codex ?? {}),
    },
  };
  return merged;
}

/** R2L_VALIDATE env knob: "0" disables the validate1/validate2 stages; unset or
 *  "1" keeps them on (the default). Read here so both the CLI and the site honor it. */
function envValidateFlag(): Repo2LearnFlags {
  const v = process.env.R2L_VALIDATE;
  if (v === "0") return { validate: false };
  if (v === "1") return { validate: true };
  return {}; // unset / unknown → leave default (on)
}

/** R2L_SPINE env knob: "0" disables the spine materialization stage (falls back to
 *  the legacy "explain real source" mode); unset or "1" keeps it on (the default). */
function envSpineFlag(): Repo2LearnFlags {
  const v = process.env.R2L_SPINE;
  if (v === "0") return { spine: false };
  if (v === "1") return { spine: true };
  return {};
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
