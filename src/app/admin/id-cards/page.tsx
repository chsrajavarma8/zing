import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { IdCardTeamRow } from "@/components/admin/id-card-team-row";
import { Card, CardContent } from "@/components/ui/card";
import type { Team, TeamMember } from "@/types/database";

export default async function AdminIdCardsPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: teams } = await supabase.from("teams").select("*").eq("event_id", ctx.event.id).order("team_name");
  const { data: members } = await supabase.from("team_members").select("*").eq("event_id", ctx.event.id);
  const { data: cards } = await supabase.from("id_cards").select("team_member_id, revoked");

  const teamList = (teams as unknown as Team[] | null) ?? [];
  const memberList = (members as unknown as TeamMember[] | null) ?? [];
  const cardMap = new Map(((cards as unknown as { team_member_id: string; revoked: boolean }[] | null) ?? []).map((c) => [c.team_member_id, c.revoked]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ID Cards</h1>
        <p className="text-muted-foreground">Issue and revoke participant ID cards.</p>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {teamList.map((t) => (
            <IdCardTeamRow
              key={t.id}
              team={t}
              eventId={ctx.event.id}
              members={memberList.filter((m) => m.team_id === t.id)}
              cardMap={cardMap}
              canManage={canManage(ctx)}
            />
          ))}
          {teamList.length === 0 && <p className="text-center text-muted-foreground py-6">No teams yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
