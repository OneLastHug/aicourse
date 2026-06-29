"use client";

import { syntaxClass, tokenizeCode } from "@/lib/syntax";

export function HighlightedCode({
  code,
  language = "text",
  highlightedLines = [],
  className = "",
  }: {
  code: string;
  language?: string;
  highlightedLines?: number[];
  className?: string;
}) {
  const lines = tokenizeCode(code, language);
  return (
    <pre className={`shiki syntax-fallback ${className}`.trim()} data-codex-kind="code" data-codex-language={language}>
      <code>
        {lines.map((tokens, lineIdx) => {
          const lineNo = lineIdx + 1;
          return (
            <span key={lineNo} className={highlightedLines.includes(lineNo) ? "line hl-line" : "line"}>
              {tokens.length
                ? tokens.map((token, tokenIdx) => {
                    const tokenClass = syntaxClass(token.type);
                    return tokenClass ? (
                      <span key={tokenIdx} className={tokenClass}>
                        {token.text}
                      </span>
                    ) : (
                      token.text
                    );
                  })
                : " "}
            </span>
          );
        })}
      </code>
    </pre>
  );
}
