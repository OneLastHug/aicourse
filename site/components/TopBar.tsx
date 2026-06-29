import Link from "next/link";
import { LangSwitcher } from "./LangSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
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
        <Logo size={28} className="shrink-0" />
        <span className="truncate text-sm font-semibold tracking-tight">
          {title}
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <LangSwitcher />
        <ThemeToggle locale={locale} />
      </div>
    </header>
  );
}
