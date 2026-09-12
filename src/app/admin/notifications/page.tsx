import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { NotificationComposer } from "@/components/admin/notification-composer";
import { CancelNotificationButton } from "@/components/admin/cancel-notification-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Round, Team } from "@/types/database";

export default async function AdminNotificationsPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [{ data: rounds }, { data: teams }, { data: notifications }] = await Promise.all([
    supabase.from("rounds").select("*").eq("event_id", ctx.event.id).order("order_index"),
    supabase.from("teams").select("*").eq("event_id", ctx.event.id).order("team_name"),
    supabase.from("notifications").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Send an event update</h1>
        <p className="text-muted-foreground">Reach the right participants with clear, timely information.</p>
      </div>

      {!process.env.WHATSAPP_PROVIDER && (
        <Card className="border-rose/40 bg-rose/5">
          <CardContent className="py-3 text-sm text-muted-foreground">
            WhatsApp isn&apos;t configured: messages sent on that channel will be marked &ldquo;not configured&rdquo;
            instead of pretending to deliver. Set <code>WHATSAPP_PROVIDER</code> in your environment to enable it.
          </CardContent>
        </Card>
      )}

      <NotificationComposer
        eventId={ctx.event.id}
        rounds={(rounds as unknown as Round[] | null) ?? []}
        teams={(teams as unknown as Team[] | null) ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent notifications</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(notifications as unknown as
                | { id: string; title: string; audience_type: string; priority: string; channels: string[]; sent_at: string | null; created_at: string }[]
                | null
              )?.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell className="capitalize">{n.audience_type.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{n.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{n.channels.join(", ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {n.sent_at ? new Date(n.sent_at).toLocaleString() : "Scheduled"}
                  </TableCell>
                  <TableCell>
                    {!n.sent_at && canManage(ctx) && (
                      <CancelNotificationButton notificationId={n.id} eventId={ctx.event.id} title={n.title} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(!notifications || notifications.length === 0) && (
            <p className="py-8 text-center text-muted-foreground">No notifications sent yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
