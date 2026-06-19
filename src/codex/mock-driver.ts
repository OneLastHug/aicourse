import type { CodexCall, CodexDriver, CodexResult } from "./driver";
import { log } from "../util/log";

/**
 * Offline stand-in for codex. Used for tests and the `--sample` mode so the
 * full pipeline runs without the codex CLI installed.
 *
 * Pass a `responder` to return structured, scenario-specific output (e.g. the
 * sample generator injects canned outline/lesson JSON). Without one, it returns
 * a tiny placeholder so basic plumbing tests still work.
 */
export class MockCodexDriver implements CodexDriver {
  readonly kind = "mock" as const;
  constructor(
    private opts: {
      responder?: (call: CodexCall) => string | Promise<string>;
      delayMs?: number;
    } = {},
  ) {}

  async run(call: CodexCall): Promise<CodexResult> {
    const started = Date.now();
    log.step(`mock codex · ${call.label}`);
    if (this.opts.delayMs) await sleep(this.opts.delayMs);

    const text = this.opts.responder
      ? await this.opts.responder(call)
      : JSON.stringify({ label: call.label, note: "mock placeholder" });

    return { text, durationMs: Date.now() - started };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
