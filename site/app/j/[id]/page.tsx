import { redirect } from "next/navigation";
import { preferredLocale } from "@/lib/server/locale";

export default async function OldProgress({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/${await preferredLocale()}/j/${id}`);
}
