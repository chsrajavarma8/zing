import { getPortalContext } from "@/lib/portal/data";
import { TeamManager } from "@/components/portal/team-manager";

export default async function TeamPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const isLead = portal.membership.role === "lead";
  const deadlinePassed = portal.event.registration_close_at
    ? Date.now() > Date.parse(portal.event.registration_close_at)
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{portal.team.team_name}</h1>
        <p className="text-muted-foreground">{portal.team.reference_id}</p>
      </div>

      <TeamManager
        team={portal.team}
        teammates={portal.teammates}
        event={portal.event}
        isLead={isLead}
        deadlinePassed={deadlinePassed}
      />
    </div>
  );
}
