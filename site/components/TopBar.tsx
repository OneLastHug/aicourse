import Link from "next/link";
import { LangSwitcher } from "./LangSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import type { Locale } from "@/lib/types";

export function TopBar({
  title,
  locale,
}: {
  title: string;
  locale: Locale;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <Link href={`/${locale}`} className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-[11px] font-bold text-white dark:bg-white dark:text-zinc-900">
          R2L
        </span>
        <span className="truncate text-sm font-semibold tracking-tight">
          {title}
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <LangSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
