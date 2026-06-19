import type { CodexCall } from "../codex/driver";
import { sampleLessons, sampleOutline } from "./fixtures";

/**
 * Routes a mock codex call to the right sample fixture by its label.
 * Used by the offline `--sample` mode so the full pipeline runs end-to-end.
 */
export function sampleResponder(call: CodexCall): string {
  if (call.label === "outline") return JSON.stringify(sampleOutline);
  const m = /^lesson:(s\d+)$/.exec(call.label);
  if (m && sampleLessons[m[1] as string]) {
    return JSON.stringify(sampleLessons[m[1] as string]);
  }
  // Fallback: empty but valid lesson body.
  return JSON.stringify({ id: call.label, problem: { zh: "", en: "" }, howItWorks: [], deepDive: { zh: "", en: "" }, references: [], compare: { rows: [] }, loc: 0 });
}
