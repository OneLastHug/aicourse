import type { CodexConfig } from "../types";

/** A single codex inference call. */
export interface CodexCall {
  /** Human label for logging / cache keying. */
  label: string;
  /** The prompt. */
  prompt: string;
  /** Working directory the agent runs in (so it can read real files). */
  cwd: string;
  /**
   * Optional file to read the structured output from. Codex writes its final
   * assistant message here when `--output-last-message` is used; otherwise the
   * driver parses stdout. The driver is free to ignore this.
   */
  outputFile?: string;
}

export interface CodexResult {
  /** Raw text returned by the model (final assistant message). */
  text: string;
  /** How long the call took. */
  durationMs: number;
}

/**
 * A swappable interface to codex. The real implementation shells out to the
 * `codex exec` CLI; the mock returns canned data so the whole pipeline is
 * testable offline (codex is not installed in the dev sandbox).
 */
export interface CodexDriver {
  readonly kind: "cli" | "mock";
  run(call: CodexCall): Promise<CodexResult>;
}

export type { CodexConfig };
