#!/usr/bin/env node
/**
 * nano-agent — a tiny Claude-Code-like coding agent, from 0 to 1.
 * (Sample repo used by Repo2Learn's offline demo.)
 */
import { run } from "./loop.js";
import { systemPrompt } from "./prompt.js";

const messages = [{ role: "user", content: process.argv[2] ?? "say hello" }];
await run({ messages, systemPrompt });
