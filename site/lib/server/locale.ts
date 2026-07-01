import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale } from "@/lib/locale";
import type { Locale } from "@/lib/types";

export async function preferredLocale(fallback: Locale = DEFAULT_LOCALE): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value, fallback);
}
