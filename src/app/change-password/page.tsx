import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext, isStaff } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ChangePasswordPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/change-password");

  // Nothing to do here for admins (never get temporary passwords) or for
  // participants who've already completed their mandatory change.
  if (isStaff(ctx) || !ctx.mustChangePassword) {
    redirect(isStaff(ctx) ? "/admin" : "/portal");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <ChangePasswordForm />
    </main>
  );
}
