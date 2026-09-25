import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRegistrationStatus } from "@/lib/registration-status";
import { upcomingRoundDeadlines } from "@/lib/rounds";
import {
  Clock,
  Trophy,
  Bell,
  ArrowRight,
  ArrowUpRight,
  Megaphone,
  CheckCircle2,
  ClipboardCheck,
  MessageCircle,
  Mail,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/date";
import { shouldShowWhatsappGroupButton } from "@/lib/whatsapp";
import { Reveal } from "@/components/motion/reveal";
import type { Round, Submission } from "@/types/database";

// BUG-027: the card shows the team's own review status, never the event's
// registration window.
const TEAM_STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  verified: "Verified",
  disqualified: "Disqualified",
};

export default async function PortalDashboardPage() {
  const portal = await getPortalContext();
  if (!portal) return null;
  const { membership, team, event, teammates } = portal;
  const firstName = membership.full_name.split(" ")[0];

  const supabase = await createClient();
  const [{ data: rounds }, { data: submissions }, { data: notifRecipients }, { data: publications }, { data: announcements }] =
    await Promise.all([
      supabase.from("rounds").select("*").eq("event_id", event.id).order("order_index"),
      supabase.from("submissions").select("*").eq("team_id", team.id),
      supabase
        .from("notification_recipients")
        .select("id, read_at, notifications(id, title, message, priority, created_at)")
        .eq("profile_id", portal.userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("publications").select("round_id, scope, is_published").eq("scope", "participant"),
      supabase
        .from("announcements")
        .select("*")
        .eq("event_id", event.id)
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(3),
    ]);

  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const currentRound = roundList.find((r) => r.is_active) ?? roundList[0];
  const submissionList = (submissions as unknown as Submission[] | null) ?? [];
  const unreadCount = (notifRecipients as unknown as { read_at: string | null }[] | null)?.filter((n) => !n.read_at).length ?? 0;
  const registrationStatus = getRegistrationStatus(event);
  const hasReleasedResults = (publications as unknown as { round_id: string; is_published: boolean }[] | null)?.some((p) => p.is_published) ?? false;

  // Reaching the portal already requires a private password (the layout
  // redirects legacy temporary-password accounts to /change-password), so
  // there is no "finish setting up" action to show here any more (BUG-005).
  const requiredActions: { label: string; href: string }[] = [];
  if (currentRound) {
    const submission = submissionList.find((s) => s.round_id === currentRound.id);
    const hasSubmitted = Boolean(submission?.drive_folder_url || submission?.document_storage_path || submission?.document_link_url);
    if (!hasSubmitted) {
      requiredActions.push({
        label: currentRound.key === "minor" ? "Submit your Talent Round document" : `Submit your Google Drive folder link for ${currentRound.name}`,
        href: "/portal/submission",
      });
    }
  }

  const upcomingDeadlines = upcomingRoundDeadlines(roundList);

  const submissionStatusSummary = roundList.find((r) => submissionList.some((s) => s.round_id === r.id))
    ? "In progress"
    : "Not started";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-primary/12 pb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome, {firstName}.</h1>
          <p className="mt-1 text-muted-foreground">Here&apos;s what your team needs to know.</p>
        </div>
        {shouldShowWhatsappGroupButton(event) && (
          <Button asChild variant="outline" className="border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10">
            <a href={event.whatsapp_group_url!} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> Join WhatsApp Group
            </a>
          </Button>
        )}
      </div>

      <Card className={requiredActions.length > 0 ? "border-primary/40 bg-primary/5" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">Your next action</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {requiredActions.length > 0 ? (
            requiredActions.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className="flex items-center justify-between gap-3 rounded-md border border-primary/25 bg-background p-4 text-sm font-medium hover:bg-accent"
              >
                {a.label}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">You&apos;re up to date. New actions will appear here when available.</p>
          )}
        </CardContent>
      </Card>

      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard icon={Trophy} label="Current round" value={currentRound?.name ?? "TBA"} />
          <StatusCard
            icon={CheckCircle2}
            label={registrationStatus.isOpen ? "Team registration (registration open)" : "Team registration"}
            value={TEAM_STATUS_LABEL[team.status] ?? team.status}
            tone={team.status === "verified" ? "good" : team.status === "disqualified" ? "warn" : undefined}
          />
          <StatusCard icon={Clock} label="Next deadline" value={upcomingDeadlines[0] ? formatDate(upcomingDeadlines[0].ends_at!) : "TBA"} />
          <StatusCard icon={ClipboardCheck} label="Submission status" value={submissionStatusSummary} />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                Your team
                {teammates.length < event.team_size_min && <Badge variant="destructive">Incomplete</Badge>}
              </CardTitle>
              <CardDescription>{team.reference_id}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/team">
                Manage <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {teammates.map((tm) => (
              <div key={tm.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {tm.full_name} {tm.role === "lead" && <Badge variant="secondary" className="ml-1">Lead</Badge>}
                  </p>
                  <p className="text-muted-foreground">{tm.college}</p>
                </div>
                <Badge variant={tm.verification_status === "verified" ? "default" : "outline"}>{tm.verification_status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing upcoming right now.</p>
            ) : (
              upcomingDeadlines.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-muted-foreground">{formatDateTime(r.ends_at!)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      </Reveal>

      <Reveal delay={0.1}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Latest announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {announcements && announcements.length > 0 ? (
              (announcements as unknown as { id: string; title: string; published_at: string }[]).map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.published_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Announcements will appear here when published.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Released results</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/results">
                View <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {hasReleasedResults ? "Results have been released for at least one round." : "Your results have not been released yet."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Notifications</CardTitle>
              {unreadCount > 0 && <Badge>{unreadCount} unread</Badge>}
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/notifications">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(notifRecipients as unknown as { id: string; read_at: string | null; notifications: { title: string } | null }[] | null)?.length ? (
              (notifRecipients as unknown as { id: string; read_at: string | null; notifications: { title: string } | null }[])
                .slice(0, 4)
                .map((n) => (
                  <div key={n.id} className="flex items-start gap-2 text-sm">
                    <Bell className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${!n.read_at ? "text-primary" : "text-muted-foreground"}`} />
                    <p className={!n.read_at ? "font-medium" : "text-muted-foreground"}>{n.notifications?.title}</p>
                  </div>
                ))
            ) : (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      </Reveal>

      <Reveal delay={0.12}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Need help?</CardTitle>
            <CardDescription>
              Stuck on registration, a submission, or your account? Reach out and an organizer will follow up.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button variant="outline" asChild>
              <a href={`mailto:${event.support_email}`}>
                <Mail className="h-4 w-4" /> {event.support_email}
              </a>
            </Button>
            {event.support_phone && (
              <Button variant="outline" asChild>
                <a href={`tel:${event.support_phone}`}>
                  <Phone className="h-4 w-4" /> {event.support_phone}
                </a>
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href="/portal/requests">
                Raise a request <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            tone === "good" ? "bg-emerald-500/10 text-emerald-500" : tone === "warn" ? "bg-rose/15 text-rose" : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
