import { redirect } from "next/navigation";
export default async function OldRepoRoot({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await params;
  redirect(`/en/c/${repoId}`);
}
