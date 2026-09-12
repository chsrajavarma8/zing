import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList } from "@/components/portal/notifications-list";

export default async function NotificationsPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_recipients")
    .select("id, read_at, channel, notifications(id, title, message, priority, action_link, created_at)")
    .eq("profile_id", portal.userId)
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    read_at: string | null;
    channel: string;
    notifications: { id: string; title: string; message: string; priority: string; action_link: string | null; created_at: string } | null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Your event updates</h1>
        <p className="text-muted-foreground">Check this page regularly alongside your registered email.</p>
      </div>
      <NotificationsList items={(data as unknown as Row[] | null) ?? []} />
    </div>
  );
}
