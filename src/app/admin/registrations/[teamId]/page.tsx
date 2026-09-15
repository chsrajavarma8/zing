import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamStatusControl } from "@/components/admin/team-status-control";
import { ResetParticipantAccess } from "@/components/admin/reset-participant-access";
import { DeleteTeamButton } from "@/components/admin/delete-team-button";
import { RemoveTeamMemberButton } from "@/components/admin/remove-team-member-button";
import { formatDate, formatDateTime } from "@/lib/date";
import type { Team, TeamMember } from "@/types/database";

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("*").eq("id", teamId).eq("event_id", ctx.event.id).maybeSingle();
  if (!team) notFound();

  const { data: members } = await supabase.from("team_members").select("*").eq("team_id", teamId).order("role", { ascending: false });

  const t = team as unknown as Team;
  const memberList = (members as unknown as TeamMember[] | null) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {t.team_name}
            {memberList.length < ctx.event.team_size_min && <Badge variant="destructive">Incomplete</Badge>}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {t.reference_id} · {memberList.length}/{ctx.event.team_size_max} members
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage(ctx) ? (
            <TeamStatusControl teamId={t.id} eventId={ctx.event.id} status={t.status} />
          ) : (
            <Badge>{t.status}</Badge>
          )}
          {canManage(ctx) && <DeleteTeamButton teamId={t.id} eventId={ctx.event.id} teamName={t.team_name} />}
        </div>
      </div>

      <div className="space-y-4">
        {memberList.map((m) => (
          <Card key={m.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  {m.full_name} {m.role === "lead" && <Badge variant="secondary" className="ml-1">Lead</Badge>}
                </CardTitle>
                <CardDescription className="font-mono text-xs">{m.reference_id}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.verification_status === "verified" ? "default" : "outline"}>{m.verification_status}</Badge>
                {canManage(ctx) && <ResetParticipantAccess teamMemberId={m.id} eventId={ctx.event.id} />}
                {canManage(ctx) && m.role !== "lead" && (
                  <RemoveTeamMemberButton teamMemberId={m.id} eventId={ctx.event.id} fullName={m.full_name} />
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label="Email" value={m.email} />
              <Field label="Mobile" value={m.mobile} />
              <Field label="WhatsApp" value={m.whatsapp} />
              <Field label={m.education_level === "school" ? "School" : "College"} value={m.college} />
              {m.education_level === "school" ? (
                <Field label="Class / grade" value={m.class_grade || "—"} />
              ) : (
                <Field label="Roll number" value={m.roll_number || "—"} />
              )}
              <Field label="Date of birth" value={formatDate(m.date_of_birth)} />
              {m.gender && <Field label="Gender" value={m.gender} />}
              <Field label="Registered" value={formatDateTime(m.created_at)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
