"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IdCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { issueIdCardsForTeam, revokeIdCard } from "@/app/admin/id-cards/actions";
import type { Team, TeamMember } from "@/types/database";

export function IdCardTeamRow({
  team,
  eventId,
  members,
  cardMap,
  canManage,
}: {
  team: Team;
  eventId: string;
  members: TeamMember[];
  cardMap: Map<string, boolean>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const issuedCount = members.filter((m) => cardMap.has(m.id)).length;

  async function issue() {
    setBusy(true);
    const result = await issueIdCardsForTeam(team.id, eventId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not issue.");
      return;
    }
    toast.success(result.issued ? `Issued ${result.issued} card(s)` : "Already up to date");
    router.refresh();
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{team.team_name}</p>
          <p className="text-xs text-muted-foreground">
            {issuedCount}/{members.length} issued
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={issue} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
            Issue for team
          </Button>
        )}
      </div>
      {issuedCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {members
            .filter((m) => cardMap.has(m.id))
            .map((m) => {
              const revoked = cardMap.get(m.id);
              return (
                <button
                  key={m.id}
                  disabled={!canManage}
                  onClick={async () => {
                    const result = await revokeIdCard(m.id, eventId, !revoked);
                    if (!result.ok) toast.error(result.error ?? "Could not update.");
                    else router.refresh();
                  }}
                >
                  <Badge variant={revoked ? "destructive" : "secondary"}>
                    {m.full_name} {revoked ? "(revoked)" : ""}
                  </Badge>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
