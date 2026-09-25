import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SkipLink } from "@/components/site/skip-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserContext();
  if (!user) redirect("/login?next=/admin");

  const ctx = await getAdminContext();

  if (!ctx) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader className="items-center text-center">
            <ShieldAlert className="mb-2 h-8 w-8 text-destructive" />
            <CardTitle>Not authorized</CardTitle>
            <CardDescription>
              {user.email} doesn&apos;t have admin access to this event. Ask a platform super admin to invite you.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <SkipLink />
      <AdminSidebar role={ctx.role} eventName={ctx.event.name} />
      <main id="main-content" className="overflow-x-hidden px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
