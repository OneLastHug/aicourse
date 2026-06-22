/** Shared progress + time helpers for the running list and the per-job page.
 *  Kept framework-free so both server and client components can import it. */

/** Coarse overall-completion percent for a running job, by pipeline stage.
 *  The pipeline emits: ingest → analyze → curriculum → lessons → validate1 →
 *  validate2 → translate → done. (Older aliases outline/content/render are
 *  mapped too so historical job records still render.) */
export function progressPct(stage: string, lessonsDone: number, lessonsTotal: number): number {
  switch (stage) {
    case "done": return 100;
    case "translate": return 95;
    case "validate2": return 92;
    case "validate1": return 90;
    case "lessons":
    case "content":
      return lessonsTotal > 0 ? 20 + Math.round((lessonsDone / lessonsTotal) * 65) : 20;
    case "curriculum": return 15;
    case "analyze":
    case "outline": return 10;
    case "ingest": return 5;
    case "queued": return 2;
    default: return 2;
  }
}

/** Estimate the seconds of work left, extrapolating from elapsed time and the
 *  coarse progress percent. Returns null while it's too early to say anything
 *  meaningful (just started, or no measurable progress yet). */
export function etaSeconds(
  startedAt: number,
  nowMs: number,
  stage: string,
  lessonsDone: number,
  lessonsTotal: number,
): number | null {
  const pct = progressPct(stage, lessonsDone, lessonsTotal);
  if (pct <= 2 || pct >= 100) return null;
  const elapsed = (nowMs - startedAt) / 1000;
  if (elapsed < 5) return null;
  const remaining = (elapsed * (100 - pct)) / pct;
  return Math.min(Math.max(remaining, 5), 6 * 3600);
}

/** Format a duration in seconds as `m:ss`, or `Xh Ym` past an hour. */
export function fmtClock(s: number): string {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return h + "h " + (m % 60) + "m";
  }
  return m + ":" + String(sec).padStart(2, "0");
}
