import { redirect } from "next/navigation";
import { normalizeLocale } from "@/lib/locale";

export default async function OldCourse({ params }: { params: Promise<{ repoId: string; locale: string }> }) {
  const { repoId, locale } = await params;
  redirect(`/${normalizeLocale(locale)}/c/${repoId}`);
}
