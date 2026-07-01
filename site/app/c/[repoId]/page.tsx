import { redirect } from "next/navigation";
import { preferredLocale } from "@/lib/server/locale";

export default async function OldRepoRoot({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await params;
  redirect(`/${await preferredLocale()}/c/${repoId}`);
}
