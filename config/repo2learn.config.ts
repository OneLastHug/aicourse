/**
 * Example Repo2Learn configuration. Copy to config/repo2learn.config.ts and
 * tweak, then pass values via CLI flags (flags win over file). Every default
 * already matches the user's spec: gpt-5.5 / xhigh / concurrency 5 / bilingual.
 */
import type { Repo2LearnConfig } from "../src/types";

export const config: Repo2LearnConfig = {
  codex: {
    binary: "codex",
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
    concurrency: 5,
    timeoutMs: 10 * 60 * 1000,
    extraArgs: [
      // codex sandbox/permission flags go here if your version needs them, e.g.:
      // "--full-auto",
    ],
  },
  languages: ["zh", "en"],
  targetLessonCount: 10,
  siteContentDir: "site/content/generated",
  cacheDir: ".repo2learn/cache",
  workDir: ".repo2learn/repos",
  useMock: false,
  noCache: false,
  repo: "",
};
