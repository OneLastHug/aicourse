import type { CodexCall } from "../codex/driver";
import { sampleAnalysis, sampleCourse, sampleZhLessons, sampleZhOutline } from "./fixtures";

/** Routes a mock codex call (v2, Chinese-first) to the right sample fixture by its label. */
export function sampleResponder(call: CodexCall): string {
  const lbl = call.label;
  if (lbl === "analyze") return JSON.stringify(sampleAnalysis);
  if (lbl === "curriculum") return JSON.stringify(sampleZhOutline);
  const r = /^lesson:read:(s\d+)$/.exec(lbl);
  if (r) return JSON.stringify({ mechanism: "(mock) 机制理解", codeRefs: [], insights: [], beforeAfter: "" });
  const w = /^lesson:write:(s\d+)$/.exec(lbl);
  if (w && sampleZhLessons[w[1] as string]) return JSON.stringify(sampleZhLessons[w[1] as string]);
  if (lbl.startsWith("validate1") || lbl.startsWith("validate2")) return JSON.stringify({ passed: true, issues: [], summary: "mock: ok" });
  if (lbl === "translate:outline") return JSON.stringify(sampleCourse.outline);
  const tl = /^translate:lesson:(s\d+)$/.exec(lbl);
  if (tl && sampleCourse.lessons[tl[1] as string]) return JSON.stringify(sampleCourse.lessons[tl[1] as string]);
  return "{}";
}
