/** Stage 6 — translate the validated English course to bilingual (add zh, keep en + code/paths/ids as-is). */
export function translatePrompt(courseJson: string): string {
  return `Translate this entire English tutorial into Simplified Chinese, preserving ALL depth, structure, and meaning.

Rules:
- Every user-facing text field becomes an object {"zh":"<中文翻译>","en":"<original English>"}.
- Code snippets, file paths, ids, URLs, and the "language"/"highlightLines" fields stay exactly as-is (not translated).
- Translate prose faithfully and naturally for a Chinese technical reader; keep all technical precision.
- Keep the exact same JSON structure; only leaf text fields become bilingual.

Return STRICT JSON ONLY — the full bilingual course.

ENGLISH COURSE (JSON):
${courseJson}`;
}
