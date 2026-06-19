"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/types";

/** Keeps <html lang> in sync with the active locale (a11y). */
export function LangSetter({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);
  return null;
}
