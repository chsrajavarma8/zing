import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth/session";
import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalBottomNav } from "@/components/portal/portal-bottom-nav";
import { SkipLink } from "@/components/site/skip-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/portal");
  if (ctx.mustChangePassword) redirect("/change-password");

  const portal = await getPortalContext();

  if (!portal) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader className="items-center text-center">
            <AlertTriangle className="mb-2 h-8 w-8 text-muted-foreground" />
            <CardTitle>No registration found</CardTitle>
            <CardDescription>
              We couldn&apos;t find a team registration linked to {ctx.email}. If you just registered, make sure
              you signed in with the same email address you registered with.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/register">Register a team</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Contact support</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("notification_recipients")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", portal.userId)
    .eq("channel", "in_app")
    .is("read_at", null);

  return (
    <div className="flex min-h-screen">
      <SkipLink />
      <PortalSidebar eventName={portal.event.name} unreadCount={count ?? 0} role={portal.membership.role} />
      <main id="main-content" className="flex-1 overflow-x-hidden px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <PortalBottomNav unreadCount={count ?? 0} />
    </div>
  );
}
