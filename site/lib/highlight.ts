import { createHighlighter, type Highlighter, type ShikiTransformer } from "shiki";

/** Shiki singleton — created once, reused across all code blocks. */
let hlPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!hlPromise) {
    hlPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "typescript",
        "javascript",
        "tsx",
        "jsx",
        "python",
        "bash",
        "shell",
        "json",
        "go",
        "rust",
        "css",
        "html",
      ],
    });
  }
  return hlPromise;
}

const lineHighlighter = (lines: number[]): ShikiTransformer => ({
  name: "repo2learn:hl",
  line(node, line) {
    if (lines.includes(line)) {
      const n = node as unknown as { properties?: Record<string, unknown> };
      n.properties = n.properties ?? {};
      const cur = n.properties.className;
      const arr: string[] = Array.isArray(cur)
        ? cur.map((v) => String(v))
        : cur != null
          ? [String(cur)]
          : [];
      if (!arr.includes("hl-line")) arr.push("hl-line");
      n.properties.className = arr;
    }
  },
});

/**
 * Highlight a code snippet to themed HTML. Highlighted lines (1-based) get the
 * `hl-line` class. On any failure, fall back to escaped plain text so the page
 * never breaks.
 */
export async function highlight(
  code: string,
  lang: string,
  lines: number[],
): Promise<string> {
  try {
    const h = await getHighlighter();
    const loaded = h.getLoadedLanguages();
    const safe = loaded.includes(lang) ? lang : "typescript";
    return h.codeToHtml(code, {
      lang: safe,
      themes: { light: "github-light", dark: "github-dark" },
      transformers: [lineHighlighter(lines)],
      defaultColor: false,
    });
  } catch {
    const esc = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre class="shiki"><code>${esc}</code></pre>`;
  }
}
