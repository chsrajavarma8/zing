import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Users, FolderGit2, Inbox, Bell, TrendingUp } from "lucide-react";

export default async function AdminDashboardPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [{ data: statsRows }, { count: pendingSubmissionsCount }, { count: openRequestsCount }, { count: unverifiedCount }] =
    await Promise.all([
      supabase.rpc("event_registration_stats", { eid: ctx.event.id }),
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("event_id", ctx.event.id).eq("status", "open"),
      supabase
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ctx.event.id)
        .eq("verification_status", "pending"),
    ]);

  const stats = statsRows?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{ctx.event.name}</h1>
          <p className="text-muted-foreground">
            <Badge variant={ctx.event.status === "published" ? "default" : "outline"} className="capitalize">
              {ctx.event.status}
            </Badge>
          </p>
        </div>
        <Link href="/admin/events" className="text-sm text-primary underline underline-offset-4">
          Configure event
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Participants" value={stats?.participant_count ?? 0} />
        <StatCard icon={TrendingUp} label="Teams" value={stats?.team_count ?? 0} />
        <StatCard icon={FolderGit2} label="Pending submission reviews" value={pendingSubmissionsCount ?? 0} href="/admin/submissions" />
        <StatCard icon={Inbox} label="Open requests" value={openRequestsCount ?? 0} href="/admin/requests" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration numbers</CardTitle>
            <CardDescription>Real counts vs. the configured community-total display.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Actual registered participants" value={stats?.participant_count ?? 0} />
            <Row label="Actual registered teams" value={stats?.team_count ?? 0} />
            <Row label="Configured community base" value={stats?.community_base_count ?? ctx.event.community_base_count} />
            <Row label="Displayed community total" value={stats?.displayed_community_count ?? 0} strong />
            <Row label="Unverified participants" value={unverifiedCount ?? 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              ["/admin/registrations", "Manage registrations & teams"],
              ["/admin/rounds", "Configure rounds & exams"],
              ["/admin/judging", "Enter & publish scores"],
              ["/admin/content", "Edit homepage, FAQ, policies"],
              ["/admin/notifications", "Send a notification"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-md border p-3 text-sm hover:bg-accent">
                {label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <Card className={href ? "transition-colors hover:bg-accent/40" : undefined}>
      <CardContent className="flex items-center gap-3 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-mono text-base font-bold" : "font-mono"}>{value}</span>
    </div>
  );
}
