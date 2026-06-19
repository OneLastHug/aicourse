/**
 * Defensive extraction + validation of structured JSON returned by codex.
 *
 * Even with "return only JSON" instructions, models sometimes wrap output in
 * prose or markdown fences. These helpers locate the first balanced JSON value
 * and validate it against a predicate.
 */

export class JsonExtractionError extends Error {
  constructor(
    message: string,
    readonly raw: string,
  ) {
    super(message);
    this.name = "JsonExtractionError";
  }
}

/** Find the first balanced JSON object/array in `text` and parse it. */
export function extractJson<T = unknown>(text: string): T {
  const cleaned = stripCodeFences(text);
  const start = findFirstJsonStart(cleaned);
  if (start === -1) throw new JsonExtractionError("no JSON value found", text);

  const end = findMatchingEnd(cleaned, start);
  if (end === -1) throw new JsonExtractionError("unterminated JSON value", text);

  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch (e) {
    // Last resort: tolerate trailing commas / single quotes is intentionally NOT
    // done — we instead fail loudly so the pipeline can retry with a stricter prompt.
    throw new JsonExtractionError(`JSON.parse failed: ${(e as Error).message}`, slice);
  }
}

/** Validate a parsed value with a guard; throw a helpful error otherwise. */
export function assertShape<T>(
  value: unknown,
  guard: (v: unknown) => v is T,
  label: string,
): T {
  if (!guard(value)) {
    throw new JsonExtractionError(`invalid shape for ${label}`, JSON.stringify(value, null, 2));
  }
  return value;
}

function stripCodeFences(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1] ?? text : text;
}

function findFirstJsonStart(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{" || ch === "[") return i;
  }
  return -1;
}

/** Walk from an opening brace/bracket to its matching close, respecting
 * strings and escapes. Returns the index of the closing char, or -1. */
function findMatchingEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i] as string;
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
