import { getAdminContext, canManage } from "@/lib/auth/admin";
import { EventConfigForm } from "@/components/admin/event-config-form";

export default async function AdminEventsPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Event & Branding</h1>
        <p className="text-muted-foreground">Everything here drives the public site: name, dates, prizes, contact info.</p>
      </div>
      <EventConfigForm event={ctx.event} readOnly={!canManage(ctx)} />
    </div>
  );
}
