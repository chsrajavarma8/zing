import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList } from "@/components/portal/notifications-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default async function NotificationsPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .select("id, read_at, channel, notifications(id, title, message, priority, action_link, created_at)")
    .eq("profile_id", portal.userId)
    .eq("channel", "in_app")
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    read_at: string | null;
    channel: string;
    notifications: { id: string; title: string; message: string; priority: string; action_link: string | null; created_at: string } | null;
  };

  // Never let a query failure render as "no notifications yet" - that's
  // indistinguishable from a genuinely empty list and hid a real bug for a
  // long time (see 0037_fix_notification_rls_recursion.sql).
  if (error) {
    console.error("[NotificationsPage] failed to load notifications for", portal.userId, error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Your event updates</h1>
        <p className="text-muted-foreground">Check this page regularly alongside your registered email.</p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load your notifications</AlertTitle>
          <AlertDescription>Please try refreshing the page. If this keeps happening, contact support.</AlertDescription>
        </Alert>
      ) : (
        <NotificationsList items={(data as unknown as Row[] | null) ?? []} />
      )}
    </div>
  );
}
