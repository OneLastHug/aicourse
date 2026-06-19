import { redirect } from "next/navigation";

export default async function RepoRoot({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = await params;
  redirect(`/c/${repoId}/en`);
}
