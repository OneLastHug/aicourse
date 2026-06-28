import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodexConfig, ResearchConfig } from "../types";
import { log } from "../util/log";
import type { CodexCall, CodexDriver, CodexResult } from "./driver";

/**
 * Real codex driver. Invokes `codex exec` non-interactively. The prompt is piped
 * via STDIN (not as a CLI argument) to avoid OS ARG_MAX / E2BIG limits on large
 * prompts.
 */
export class CliCodexDriver implements CodexDriver {
  readonly kind = "cli" as const;
  constructor(private cfg: CodexConfig, private research?: ResearchConfig) {}

  async run(call: CodexCall): Promise<CodexResult> {
    const started = Date.now();
    const outFile = call.outputFile ?? join(await mkdtemp(join(tmpdir(), "repo2learn-")), "last.txt");
    const args = this.buildArgs(call, outFile);
    log.step("codex exec · " + call.label + " · model=" + this.cfg.model + " effort=" + this.cfg.reasoningEffort + (this.research?.enabled ? " research=" + this.research.mode : ""));

    const text = await new Promise<string>((resolve, reject) => {
      const proc = spawn(this.cfg.binary, args, {
        cwd: call.cwd,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stdout: string[] = [];
      const stderr: string[] = [];

      proc.stdout.on("data", (d) => stdout.push(d.toString()));
      proc.stderr.on("data", (d) => stderr.push(d.toString()));

      proc.stdin.on("error", (e) => {
        log.warn("stdin error during codex call " + call.label + ": " + e.message);
      });
      proc.stdin.write(call.prompt);
      proc.stdin.end();

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error("codex timed out after " + this.cfg.timeoutMs + "ms"));
      }, this.cfg.timeoutMs);

      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(new Error("failed to spawn codex: " + e.message + ". Is '" + this.cfg.binary + "' installed & on PATH?"));
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error("codex exited " + code + ": " + stderr.join("").slice(-500)));
          return;
        }
        resolve(stdout.join(""));
      });
    });

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
    const args: string[] = [];
    if (this.research?.enabled && this.research.mode === "limited") args.push("--search");
    args.push(
      "exec",
      "--model", this.cfg.model,
      "-c", "model_reasoning_effort=" + this.cfg.reasoningEffort,
      "-c", "model_context_window=" + this.cfg.contextWindow,
      "-C", call.cwd,
      "--output-last-message", outFile,
      ...this.cfg.extraArgs,
    );
    return args;
  }
}
