import type { ReactNode } from "react";

/** Inline formatting: `code` and **bold** (kept minimal & safe — builds React
 *  nodes, never injects HTML). */
function renderInline(text: string, kp: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <code key={`${kp}-${i}`} className="rounded bg-bg-subtle px-1 py-0.5 font-mono text-[0.85em] dark:bg-zinc-800">{tok.slice(1, -1)}</code>,
      );
    } else {
      out.push(<strong key={`${kp}-${i}`}>{tok.slice(2, -2)}</strong>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const SPECIAL = /^(#{2,4}\s|\s*[-*]\s|\s*\d+\.\s|\s*>\s?)/;

/** A GitHub-style table row: `| a | b |`. */
function isTableRow(s: string): boolean {
  return /^\s*\|.*\|\s*$/.test(s);
}
function isTableSep(s: string): boolean {
  return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(s) && s.includes("-");
}
function splitRow(s: string): string[] {
  return s.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

/** Minimal, safe Markdown subset renderer: ## / ### headings, - / 1. lists,
 *  > blockquotes, **bold**, `code`, paragraphs. Plain prose (no markup) renders
 *  as paragraphs unchanged, so it is safe to use on any text field. */
export function Prose({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const at = (k: number) => lines[k] ?? "";
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = at(i);
    if (!line.trim()) { i++; continue; }

    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const txt = h[2]!;
      blocks.push(
        level <= 2 ? (
          <h3 key={key} className="mb-2 mt-5 text-base font-semibold text-ink dark:text-zinc-100">{renderInline(txt, `h${key}`)}</h3>
        ) : (
          <h4 key={key} className="mb-1.5 mt-4 text-sm font-semibold text-ink dark:text-zinc-200">{renderInline(txt, `h${key}`)}</h4>
        ),
      );
      key++; i++; continue;
    }

    // GitHub-style table: header row, separator row, then body rows.
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(at(i + 1))) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const body: string[][] = [];
      while (i < lines.length && isTableRow(at(i)) && !isTableSep(at(i))) { body.push(splitRow(at(i))); i++; }
      blocks.push(
        <div key={key} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line dark:border-zinc-700">
                {header.map((c, j) => (
                  <th key={j} className="px-3 py-1.5 text-left font-semibold text-ink dark:text-zinc-200">{renderInline(c, `th${key}-${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r} className="border-b border-line/60 dark:border-zinc-800">
                  {row.map((c, j) => (
                    <td key={j} className="px-3 py-1.5 align-top text-ink-soft dark:text-zinc-300">{renderInline(c, `td${key}-${r}-${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      key++; continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(at(i))) { items.push(at(i).replace(/^\s*[-*]\s+/, "")); i++; }
      blocks.push(
        <ul key={key} className="my-2 list-disc space-y-1 pl-5">{items.map((it, j) => <li key={j}>{renderInline(it, `ul${key}-${j}`)}</li>)}</ul>,
      );
      key++; continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(at(i))) { items.push(at(i).replace(/^\s*\d+\.\s+/, "")); i++; }
      blocks.push(
        <ol key={key} className="my-2 list-decimal space-y-1 pl-5">{items.map((it, j) => <li key={j}>{renderInline(it, `ol${key}-${j}`)}</li>)}</ol>,
      );
      key++; continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(at(i))) { quote.push(at(i).replace(/^\s*>\s?/, "")); i++; }
      blocks.push(
        <blockquote key={key} className="my-3 border-l-4 border-brand/60 pl-4 italic text-ink-soft dark:text-zinc-300">{renderInline(quote.join(" "), `bq${key}`)}</blockquote>,
      );
      key++; continue;
    }

    const para: string[] = [];
    while (i < lines.length && at(i).trim() && !SPECIAL.test(at(i))) { para.push(at(i)); i++; }
    blocks.push(<p key={key} className="my-2 leading-relaxed">{renderInline(para.join(" "), `p${key}`)}</p>);
    key++;
  }
  return <div className={className} data-codex-kind="text">{blocks}</div>;
}
