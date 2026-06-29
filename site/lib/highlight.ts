import { createHighlighter, type Highlighter, type ShikiTransformer } from "shiki";
import { highlightToHtml, normalizeLanguage } from "./syntax";

let hlPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!hlPromise) {
    hlPromise = createHighlighter({
      themes: ["github-dark"],
      langs: ["typescript", "javascript", "tsx", "jsx", "python", "bash", "shell", "json", "go", "rust", "css", "html", "yaml", "markdown"],
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
      const arr: string[] = Array.isArray(cur) ? cur.map((v) => String(v)) : cur != null ? [String(cur)] : [];
      if (!arr.includes("hl-line")) arr.push("hl-line");
      n.properties.className = arr;
    }
  },
});

export async function highlight(code: string, lang: string, lines: number[]): Promise<string> {
  const safeLang = normalizeLanguage(lang);
  try {
    const h = await getHighlighter();
    const loaded = h.getLoadedLanguages();
    if (!loaded.includes(safeLang)) {
      return highlightToHtml(code, safeLang, lines);
    }
    return h.codeToHtml(code, { lang: safeLang, theme: "github-dark", transformers: [lineHighlighter(lines)] });
  } catch {
    return highlightToHtml(code, safeLang, lines);
  }
}
