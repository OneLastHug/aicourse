export type SyntaxTokenType =
  | "plain"
  | "comment"
  | "string"
  | "keyword"
  | "number"
  | "punctuation"
  | "function"
  | "boolean";

export interface SyntaxToken {
  text: string;
  type: SyntaxTokenType;
}

const LANG_ALIASES: Record<string, string> = {
  cjs: "javascript",
  console: "bash",
  htm: "html",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  py: "python",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  shellscript: "bash",
  ts: "typescript",
  tsx: "tsx",
  yml: "yaml",
};

const KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "def",
  "default",
  "do",
  "elif",
  "else",
  "enum",
  "except",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "func",
  "function",
  "go",
  "if",
  "impl",
  "import",
  "in",
  "interface",
  "let",
  "match",
  "new",
  "package",
  "pass",
  "private",
  "protected",
  "public",
  "return",
  "select",
  "static",
  "struct",
  "switch",
  "throw",
  "try",
  "type",
  "var",
  "while",
  "with",
  "yield",
]);

const BOOLEAN_LITERALS = new Set([
  "False",
  "None",
  "True",
  "false",
  "nil",
  "null",
  "true",
  "undefined",
]);

const SHELL_KEYWORDS = new Set(["cd", "curl", "echo", "export", "git", "npm", "pip", "python", "uvicorn"]);

export function normalizeLanguage(lang?: string | null): string {
  const clean = String(lang || "text").trim().toLowerCase();
  return LANG_ALIASES[clean] ?? clean;
}

export function syntaxClass(type: SyntaxTokenType): string | undefined {
  return type === "plain" ? undefined : `syntax-${type}`;
}

export function tokenizeCode(code: string, lang?: string | null): SyntaxToken[][] {
  const language = normalizeLanguage(lang);
  return code.split("\n").map((line) => tokenizeLine(line, language));
}

export function highlightToHtml(code: string, lang?: string | null, highlightedLines: number[] = []): string {
  const lines = tokenizeCode(code, lang).map((tokens, idx) => {
    const lineNo = idx + 1;
    const className = highlightedLines.includes(lineNo) ? ' class="line hl-line"' : ' class="line"';
    const body = tokens.map(tokenToHtml).join("") || " ";
    return `<span${className}>${body}</span>`;
  });
  return `<pre class="shiki syntax-fallback"><code>${lines.join("\n")}</code></pre>`;
}

function tokenizeLine(line: string, language: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  let index = 0;

  while (index < line.length) {
    const rest = line.slice(index);

    const comment = readComment(rest, language);
    if (comment) {
      tokens.push({ text: comment, type: "comment" });
      index += comment.length;
      continue;
    }

    const string = readString(rest);
    if (string) {
      tokens.push({ text: string, type: "string" });
      index += string.length;
      continue;
    }

    const number = /^\b\d+(?:\.\d+)?\b/.exec(rest)?.[0];
    if (number) {
      tokens.push({ text: number, type: "number" });
      index += number.length;
      continue;
    }

    const word = /^[A-Za-z_$][\w$-]*/.exec(rest)?.[0];
    if (word) {
      const next = rest.slice(word.length).trimStart();
      const type =
        BOOLEAN_LITERALS.has(word)
          ? "boolean"
          : KEYWORDS.has(word) || (language === "bash" && SHELL_KEYWORDS.has(word))
            ? "keyword"
            : next.startsWith("(")
              ? "function"
              : "plain";
      tokens.push({ text: word, type });
      index += word.length;
      continue;
    }

    const punctuation = /^[{}()[\].,;:+\-*/%=<>!|&?]+/.exec(rest)?.[0];
    if (punctuation) {
      tokens.push({ text: punctuation, type: "punctuation" });
      index += punctuation.length;
      continue;
    }

    const plain = /^[^\w"'`#/<>{}()[\].,;:+\-*/%=!|&?]+/.exec(rest)?.[0] ?? rest[0]!;
    tokens.push({ text: plain, type: "plain" });
    index += plain.length;
  }

  return tokens;
}

function readComment(rest: string, language: string): string | null {
  if (language === "html" && rest.startsWith("<!--")) {
    const end = rest.indexOf("-->", 4);
    return end >= 0 ? rest.slice(0, end + 3) : rest;
  }
  if (language === "mermaid" && rest.startsWith("%%")) return rest;
  if (["bash", "python", "yaml"].includes(language) && rest.startsWith("#")) return rest;
  if (rest.startsWith("//")) return rest;
  if (rest.startsWith("/*")) {
    const end = rest.indexOf("*/", 2);
    return end >= 0 ? rest.slice(0, end + 2) : rest;
  }
  return null;
}

function readString(rest: string): string | null {
  const quote = rest[0];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;

  let index = 1;
  while (index < rest.length) {
    if (rest[index] === "\\") {
      index += 2;
      continue;
    }
    if (rest[index] === quote) return rest.slice(0, index + 1);
    index++;
  }
  return rest;
}

function tokenToHtml(token: SyntaxToken): string {
  const escaped = escapeHtml(token.text);
  const className = syntaxClass(token.type);
  return className ? `<span class="${className}">${escaped}</span>` : escaped;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
