"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/types";

export function LangSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ locale: string }>();
  const current = (params?.locale as Locale) ?? "en";

  function set(locale: Locale) {
    if (locale === current) return;
    // Swap the leading locale segment, keep the rest of the path.
    const rest = pathname?.replace(/^\/(en|zh)(?=\/|$)/, "") ?? "";
    router.push(`/${locale}${rest}`);
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-lg border border-line p-0.5 text-xs font-medium dark:border-zinc-700">
      <button
        type="button"
        onClick={() => set("en")}
        className={`rounded-md px-2 py-1 transition ${
          current === "en"
            ? "bg-ink text-white dark:bg-white dark:text-zinc-900"
            : "text-ink-faint hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => set("zh")}
        className={`rounded-md px-2 py-1 transition ${
          current === "zh"
            ? "bg-ink text-white dark:bg-white dark:text-zinc-900"
            : "text-ink-faint hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        中
      </button>
    </div>
  );
}
