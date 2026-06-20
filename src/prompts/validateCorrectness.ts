/** Validation Round 1 — judge the tutorial itself: factual errors, web-poisoning/hallucination, depth. */
export function validateCorrectnessPrompt(courseJson: string): string {
  return `You are a rigorous senior reviewer. Review this generated tutorial (JSON) for THREE things:
1. FACTUAL ERRORS — anything technically wrong (wrong APIs, wrong semantics, incorrect claims).
2. POISONING / CONTAMINATION — statements that look sourced from low-quality, AI-generated, or SEO web content; hallucinated APIs or signatures; marketing fluff; claims that cannot be grounded in real engineering/CS knowledge.
3. DEPTH — places that are shallow, hand-wavy, or merely restate the obvious without insight.

Return STRICT JSON ONLY:
{
  "passed": <true only if there are NO errors AND depth is acceptable>,
  "issues": [
    {"severity":"error"|"warning","lessonId":"<lesson id, or omit for course-wide>","problem":"<what's wrong>","fix":"<concrete fix>"}
  ],
  "summary": "<2 sentences>"
}
Be strict. JSON only.

TUTORIAL (JSON):
${courseJson}`;
}
