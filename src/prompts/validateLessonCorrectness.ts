/** Round 1 per-lesson: check ONE lesson for factual errors, poisoning, depth. */
export function validateLessonCorrectnessPrompt(lessonId: string, lessonJson: string): string {
  return `You are a rigorous senior reviewer. Review this ONE lesson of a tutorial for:
1. FACTUAL ERRORS — anything technically wrong.
2. POISONING / CONTAMINATION — claims from low-quality/AI-generated/SEO web content; hallucinated APIs or signatures; marketing fluff.
3. DEPTH — shallow, hand-wavy, or merely restating the obvious.

Lesson ${lessonId} (JSON):
${lessonJson}

Return STRICT JSON ONLY:
{ "passed": <true only if NO errors AND depth is acceptable>, "issues": [{"severity":"error"|"warning","lessonId":"${lessonId}","problem":"...","fix":"..."}], "summary": "<1 sentence>" }
JSON only.`;
}
