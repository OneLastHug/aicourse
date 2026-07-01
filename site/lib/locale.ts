import type { Locale } from "./types";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "r2l_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "zh";
}

export function normalizeLocale(value: string | undefined | null, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(value) ? value : fallback;
}
