import { redirect } from "next/navigation";
export default async function OldCourse({ params }: { params: Promise<{ repoId: string; locale: string }> }) {
  const { repoId, locale } = await params;
  redirect(`/${locale}/c/${repoId}`);
}
