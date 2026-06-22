/**
 * Defensive extraction + validation of structured JSON returned by codex.
 *
 * Even with "return only JSON" instructions, models sometimes wrap output in
 * prose or markdown fences, or emit JS-object-literal style (unquoted keys,
 * single quotes, // comments, trailing commas) instead of strict JSON. These
 * helpers locate the first balanced JSON value, repair the common deviations,
 * and validate the result against a predicate.
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
  } catch (strictErr) {
    // Strict parse failed — most often because the model emitted a JS object
    // literal (unquoted keys / single quotes / comments / trailing commas)
    // rather than RFC 8259 JSON. Repair the structural deviations (without ever
    // touching the bytes inside a double-quoted string, so code snippets stay
    // intact) and try once more before giving up.
    try {
      return relaxedJsonParse(slice) as T;
    } catch {
      throw new JsonExtractionError(`JSON.parse failed: ${(strictErr as Error).message}`, slice);
    }
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
  // Prefer a ```json fence; otherwise the first fence that actually contains a
  // JSON value, so a leading non-JSON code example doesn't shadow the payload.
  const fences = [...text.matchAll(/```(\w+)?\s*([\s\S]*?)```/gi)];
  if (fences.length === 0) return text;
  const json = fences.find((f) => (f[1] ?? "").toLowerCase() === "json");
  if (json?.[2]) return json[2];
  const withBrace = fences.find((f) => /[{[]/.test(f[2] ?? ""));
  return withBrace?.[2] ?? fences[0]?.[2] ?? text;
}

function findFirstJsonStart(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{" || ch === "[") return i;
  }
  return -1;
}

/** Walk from an opening brace/bracket to its matching close, respecting
 * strings and escapes. Tracks both double- and single-quoted strings so that a
 * relaxed (JS-literal) input whose string values contain braces is still
 * balanced correctly. Returns the index of the closing char, or -1. */
function findMatchingEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let quote: '"' | "'" | "" = "";
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i] as string;
    if (quote) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Rebuild a strict-JSON string from a JS-object-literal-ish one, then parse it.
 * Single pass; the content of double-quoted strings is copied verbatim so real
 * code snippets are never modified. Outside strings it:
 *   - drops `//` line and `/* *​/` block comments
 *   - converts single-quoted strings to double-quoted (escaping as needed)
 *   - quotes unquoted object keys (identifier immediately before a `:`)
 *   - removes trailing commas before `}` / `]`
 */
function relaxedJsonParse(text: string): unknown {
  const n = text.length;
  let out = "";
  let i = 0;

  const lastSignificant = (): string => {
    for (let k = out.length - 1; k >= 0; k--) {
      const c = out[k] as string;
      if (c !== " " && c !== "\n" && c !== "\r" && c !== "\t") return c;
    }
    return "";
  };

  while (i < n) {
    const ch = text[i] as string;

    // Double-quoted string: copy verbatim, honoring escapes.
    if (ch === '"') {
      out += ch;
      i++;
      while (i < n) {
        const c = text[i] as string;
        if (c === "\\") { out += c + (text[i + 1] ?? ""); i += 2; continue; }
        out += c;
        i++;
        if (c === '"') break;
      }
      continue;
    }

    // Single-quoted string: re-emit as a proper JSON double-quoted string.
    if (ch === "'") {
      i++;
      let s = "";
      while (i < n) {
        const c = text[i] as string;
        if (c === "\\") {
          const nx = text[i + 1] ?? "";
          s += nx === "'" ? "'" : c + nx; // \' -> '   (keep other escapes)
          i += 2;
          continue;
        }
        if (c === "'") { i++; break; }
        s += c;
        i++;
      }
      out += JSON.stringify(s);
      continue;
    }

    // Comments.
    if (ch === "/" && text[i + 1] === "/") { i += 2; while (i < n && text[i] !== "\n") i++; continue; }
    if (ch === "/" && text[i + 1] === "*") { i += 2; while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue; }

    // Trailing comma before a closer.
    if (ch === ",") {
      let j = i + 1;
      while (j < n && /\s/.test(text[j] as string)) j++;
      if (text[j] === "}" || text[j] === "]") { i++; continue; }
      out += ch;
      i++;
      continue;
    }

    // Unquoted object key: identifier at a key position, followed by `:`.
    if (/[A-Za-z_$]/.test(ch)) {
      const prev = lastSignificant();
      if (prev === "{" || prev === ",") {
        let j = i;
        let id = "";
        while (j < n && /[\w$]/.test(text[j] as string)) { id += text[j]; j++; }
        let k = j;
        while (k < n && /\s/.test(text[k] as string)) k++;
        if (text[k] === ":") { out += JSON.stringify(id); i = j; continue; }
      }
      out += ch;
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  return JSON.parse(out);
}
