import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodexConfig } from "../types";
import { log } from "../util/log";
import type { CodexCall, CodexDriver, CodexResult } from "./driver";

/**
 * Real codex driver. Invokes the local `codex exec` CLI non-interactively with
 * the user-specified model (gpt-5.5) and reasoning effort (xhigh), runs the
 * agent in the repo working directory so it can read files, and captures the
 * final assistant message via `--output-last-message`.
 *
 * NOTE: exact flag names can vary across codex versions; every flag is derived
 * from CodexConfig so users can override via config/repo2learn.config.ts.
 */
export class CliCodexDriver implements CodexDriver {
  readonly kind = "cli" as const;
  constructor(private cfg: CodexConfig) {}

  async run(call: CodexCall): Promise<CodexResult> {
    const started = Date.now();
    const outFile =
      call.outputFile ??
      join(await mkdtemp(join(tmpdir(), "repo2learn-")), "last.txt");

    const args = this.buildArgs(call, outFile);
    log.step(`codex exec · ${call.label} · model=${this.cfg.model} effort=${this.cfg.reasoningEffort}`);

    const text = await new Promise<string>((resolve, reject) => {
      const proc = spawn(this.cfg.binary, args, {
        cwd: call.cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout: string[] = [];
      const stderr: string[] = [];

      proc.stdout.on("data", (d) => stdout.push(d.toString()));
      proc.stderr.on("data", (d) => stderr.push(d.toString()));

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error(`codex timed out after ${this.cfg.timeoutMs}ms`));
      }, this.cfg.timeoutMs);

      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`failed to spawn codex: ${e.message}. Is '${this.cfg.binary}' installed & on PATH?`));
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`codex exited ${code}: ${stderr.join("").slice(-500)}`));
          return;
        }
        resolve("");
      });
    });

    // Prefer the structured last-message file; fall back to stdout.
    let final = text;
    try {
      final = (await readFile(outFile, "utf8")).trim();
    } catch {
      // Some codex versions print the message to stdout instead.
    }
    if (!final) final = text.trim();

    if (call.outputFile == null) await rm(join(outFile, ".."), { recursive: true, force: true }).catch(() => {});

    return { text: final, durationMs: Date.now() - started };
  }

  private buildArgs(call: CodexCall, outFile: string): string[] {
    const args = [
      "exec",
      "--model", this.cfg.model,
      "-c", `model_reasoning_effort=${this.cfg.reasoningEffort}`,
      "-C", call.cwd,
      "--output-last-message", outFile,
      ...this.cfg.extraArgs,
      call.prompt,
    ];
    return args;
  }
}

/** Helper for the mock/pipeline to write a canned result to the same shape. */
export async function writeResultStub(file: string, text: string): Promise<void> {
  await writeFile(file, text, "utf8");
}
