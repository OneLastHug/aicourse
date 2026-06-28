import { DEFAULT_CONFIG, type CodexConfig, type Repo2LearnConfig, type ResearchConfig } from "./types";

/** CLI flags / file overrides, all optional, codex overridable field-by-field. */
export type Repo2LearnFlags = Partial<Omit<Repo2LearnConfig, "codex" | "research">> & {
  codex?: Partial<CodexConfig>;
  research?: Partial<ResearchConfig>;
};

/**
 * Load and merge configuration: defaults <- config file <- env <- CLI flags.
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
    research: {
      ...DEFAULT_CONFIG.research,
      ...(fileConfig?.research ?? {}),
      ...(flags.research ?? {}),
    },
  };
  if (!merged.research.enabled) merged.research.mode = "off";
  if (merged.research.mode === "off") merged.research.enabled = false;
  if (merged.research.mode === "limited") merged.research.enabled = true;
  return merged;
}

function envValidateFlag(): Repo2LearnFlags {
  const v = process.env.R2L_VALIDATE;
  if (v === "0") return { validate: false };
  if (v === "1") return { validate: true };
  return {};
}

function envSpineFlag(): Repo2LearnFlags {
  const v = process.env.R2L_SPINE;
  if (v === "0") return { spine: false };
  if (v === "1") return { spine: true };
  return {};
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "codex" || k === "research") continue;
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/** A stable string representation of the config bits that affect codex output,
 * used in cache keys. */
export function configFingerprint(c: Repo2LearnConfig): string {
  return [
    c.codex.model,
    c.codex.reasoningEffort,
    c.targetLessonCount,
    c.languages.join(","),
    c.research.mode,
    c.research.maxReferencesPerLesson,
  ].join("|");
}
