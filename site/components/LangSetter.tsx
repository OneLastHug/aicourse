"use client";

import { useEffect } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/locale";
import type { Locale } from "@/lib/types";

/** Keeps <html lang> in sync with the active locale (a11y). */
export function LangSetter({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  }, [locale]);
  return null;
}
