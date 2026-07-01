import { redirect } from "next/navigation";
import { normalizeLocale } from "@/lib/locale";

export default async function OldLesson({ params }: { params: Promise<{ repoId: string; locale: string; id: string }> }) {
  const { repoId, locale, id } = await params;
  redirect(`/${normalizeLocale(locale)}/c/${repoId}/lessons/${id}`);
}
