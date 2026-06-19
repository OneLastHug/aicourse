import type { Reference } from "@/lib/types";

export function References({ items }: { items: Reference[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((r, i) => (
        <li key={i}>
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex items-center gap-1.5 text-sm text-ink-soft underline-offset-2 hover:text-brand hover:underline dark:text-zinc-300"
          >
            <span className="opacity-50">↗</span>
            {r.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
