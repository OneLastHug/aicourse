import type { CodexCall } from "../codex/driver";
import { sampleAnalysis, sampleCourse, sampleEnLessons, sampleEnOutline } from "./fixtures";

/** Routes a mock codex call (v2) to the right sample fixture by its label. */
export function sampleResponder(call: CodexCall): string {
  const lbl = call.label;
  if (lbl === "analyze") return JSON.stringify(sampleAnalysis);
  if (lbl === "curriculum") return JSON.stringify(sampleEnOutline);
  const r = /^lesson:read:(s\d+)$/.exec(lbl);
  if (r) return JSON.stringify({ mechanism: "(mock) mechanism understanding", codeRefs: [], insights: [], beforeAfter: "" });
  const w = /^lesson:write:(s\d+)$/.exec(lbl);
  if (w && sampleEnLessons[w[1] as string]) return JSON.stringify(sampleEnLessons[w[1] as string]);
  if (lbl === "validate1" || lbl === "validate2") return JSON.stringify({ passed: true, issues: [], summary: "mock: ok" });
  if (lbl === "translate") return JSON.stringify(sampleCourse);
  return "{}";
}
