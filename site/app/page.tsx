import { redirect } from "next/navigation";
import { preferredLocale } from "@/lib/server/locale";

/** Bare root → default locale. (The real home lives at /[locale].) */
export default async function RootPage() {
  redirect(`/${await preferredLocale()}`);
}
