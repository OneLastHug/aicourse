import { redirect } from "next/navigation";
export default async function OldLesson({ params }: { params: Promise<{ repoId: string; locale: string; id: string }> }) {
  const { repoId, locale, id } = await params;
  redirect(`/${locale}/c/${repoId}/lessons/${id}`);
}
