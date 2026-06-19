import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LangSetter } from "@/components/LangSetter";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const VALID: Locale[] = ["en", "zh"];
export function generateStaticParams() {
  return VALID.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc: Locale = VALID.includes(locale as Locale) ? (locale as Locale) : "en";
  return { title: t(loc, "meta.title"), description: t(loc, "meta.desc") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc: Locale = VALID.includes(locale as Locale) ? (locale as Locale) : "en";
  return (
    <>
      <LangSetter locale={loc} />
      {children}
    </>
  );
}
