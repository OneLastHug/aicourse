import { redirect } from "next/navigation";
import { normalizeLocale } from "@/lib/locale";

export default async function LegacyLessonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${normalizeLocale(locale)}`);
}
