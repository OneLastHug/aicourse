"use client";

import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, normalizeLocale } from "@/lib/locale";
import type { Locale } from "@/lib/types";

export function LangSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const segs = (pathname ?? "").split("/");
  const currentIdx = segs.findIndex((s) => s === "en" || s === "zh");
  const current = normalizeLocale(currentIdx >= 0 ? segs[currentIdx] : DEFAULT_LOCALE);

  function set(locale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    if (locale === current && currentIdx >= 0) return;
    const next = currentIdx >= 0 ? segs.slice() : ["", locale];
    if (currentIdx >= 0) next[currentIdx] = locale;
    router.push(next.join("/") || "/");
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
