import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { EventConfigForm } from "@/components/admin/event-config-form";
import { RegistrationFieldsManager } from "@/components/admin/registration-fields-manager";

export default async function AdminEventsPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: fields } = await supabase
    .from("registration_fields")
    .select("*")
    .eq("event_id", ctx.event.id)
    .order("order_index");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Event & Branding</h1>
        <p className="text-muted-foreground">Everything here drives the public site: name, dates, prizes, contact info.</p>
      </div>
      <EventConfigForm event={ctx.event} readOnly={!canManage(ctx)} />
      <RegistrationFieldsManager
        eventId={ctx.event.id}
        fields={
          (fields as unknown as
            | { id: string; key: string; label: string; field_type: "text" | "textarea" | "select" | "checkbox" | "number" | "date"; required: boolean; options: string[]; order_index: number; active: boolean }[]
            | null) ?? []
        }
        readOnly={!canManage(ctx)}
      />
    </div>
  );
}
