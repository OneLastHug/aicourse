import { redirect } from "next/navigation";

/** Bare root → default locale. (The real home lives at /[locale].) */
export default function RootPage() {
  redirect("/en");
}
