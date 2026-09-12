import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { RolesManager } from "@/components/admin/roles-manager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default async function AdminRolesPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  if (ctx.role !== "super_admin") {
    return (
      <Card className="max-w-md">
        <CardHeader className="items-center text-center">
          <ShieldAlert className="mb-2 h-8 w-8 text-muted-foreground" />
          <CardTitle>Super admin only</CardTitle>
          <CardDescription>Only platform super admins can manage administrator assignments.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: eventAdmins } = await supabase.from("event_admins").select("*, profiles(full_name, email)").eq("event_id", ctx.event.id);
  const { data: pendingInvites } = await supabase
    .from("admin_invites")
    .select("*")
    .eq("event_id", ctx.event.id)
    .is("consumed_at", null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles & Admins</h1>
        <p className="text-muted-foreground">Invite event admins and reviewers/judges. Only super admins can do this.</p>
      </div>
      <RolesManager
        eventId={ctx.event.id}
        admins={
          (eventAdmins as unknown as { id: string; role: string; profiles: { full_name: string | null; email: string } | null }[] | null) ?? []
        }
        pendingInvites={(pendingInvites as unknown as { id: string; email: string; role: string; invited_at: string }[] | null) ?? []}
      />
    </div>
  );
}
