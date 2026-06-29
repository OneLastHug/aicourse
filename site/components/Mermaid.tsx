"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { HighlightedCode } from "@/components/HighlightedCode";

/**
 * Renders a Mermaid diagram on the client. If the diagram text fails to parse it
 * falls back to a plain <pre> code block — a bad diagram never breaks the page.
 */
export function Mermaid({ chart, caption }: { chart: string; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const rawId = useId();
  const id = "mmd" + rawId.replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "neutral",
        });
        // Validate via mermaid's own parser so a malformed diagram falls back
        // cleanly. Do NOT sniff the rendered SVG for "error-icon"/"error-text":
        // mermaid embeds those class names in the <style> of EVERY valid diagram,
        // so that check false-positives on everything and hides all diagrams. A
        // genuine syntax error makes parse() return false (and render() throw).
        const valid = await mermaid.parse(chart.trim(), { suppressErrors: true });
        if (valid === false) {
          if (!cancelled) setFailed(true);
          return;
        }
        const { svg } = await mermaid.render(`${id}-svg`, chart.trim());
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (failed) {
    return (
      <HighlightedCode
        code={chart}
        language="mermaid"
        className="overflow-x-auto rounded-xl border border-line bg-bg-subtle p-4 text-[12px] leading-relaxed text-ink-soft dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      />
    );
  }

  return (
    <figure className="card overflow-x-auto p-4" data-codex-kind="diagram">
      <div ref={ref} className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full" />
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-ink-faint dark:text-zinc-500">{caption}</figcaption>
      )}
    </figure>
  );
}
