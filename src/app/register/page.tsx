import { getPublicEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "@/components/register/register-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getRegistrationStatus } from "@/lib/registration-status";
import { pageMetadata } from "@/lib/page-metadata";
import { formatDateTime } from "@/lib/date";

export const metadata = pageMetadata({
  title: "Register Your Team",
  description: "Register your team for Zing Hackathon by Skillglider and start building your own solution.",
  path: "/register",
});

export default async function RegisterPage() {
  const event = await getPublicEvent();

  if (!event) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <Card>
          <CardHeader className="items-center">
            <AlertTriangle className="mb-2 h-8 w-8 text-muted-foreground" />
            <CardTitle>Registration updates coming soon.</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/" className="text-sm text-primary underline underline-offset-4">
              Back to home
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const status = getRegistrationStatus(event);

  if (!status.isOpen) {
    const title = status.isClosed
      ? "Registration has closed"
      : status.isUpcoming
        ? "Registration opens soon"
        : "Registration updates coming soon.";
    const description = status.isClosed
      ? `The registration window for ${event.name} ended on ${formatDateTime(status.closesAt!)}.`
      : status.isUpcoming
        ? `Registration for ${event.name} opens on ${formatDateTime(status.opensAt!)}.`
        : "Check back soon, or reach out to the organizers if you think this is a mistake.";

    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <Card>
          <CardHeader className="items-center">
            <AlertTriangle className="mb-2 h-8 w-8 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/" className="text-sm text-primary underline underline-offset-4">
              Back to home
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: fields }, { data: policies }] = await Promise.all([
    supabase
      .from("registration_fields")
      .select("*")
      .eq("event_id", event.id)
      .eq("active", true)
      .order("order_index"),
    supabase.from("policy_versions").select("type, version").eq("event_id", event.id).eq("is_current", true),
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-16">
      <div className="relative mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-primary">{event.name}</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Register your team.</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Enter accurate details for your team lead and members. Each participant signs in individually with
            their own email to access the portal.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Team size: {event.team_size_min}–{event.team_size_max} members, including the lead.
          </p>
        </div>
        <RegisterForm
          event={{
            id: event.id,
            name: event.name,
            teamSizeMin: event.team_size_min,
            teamSizeMax: event.team_size_max,
            allowGenderField: event.allow_gender_field,
            genderFieldRequired: event.gender_field_required,
            whatsappGroupUrl: event.whatsapp_group_url,
            whatsappGroupEnabled: event.whatsapp_group_enabled,
          }}
          hasPolicies={Boolean(policies && policies.length > 0)}
          customFields={
            (fields as unknown as
              | { id: string; key: string; label: string; field_type: string; required: boolean }[]
              | null
            )?.map((f) => ({ key: f.key, label: f.label, fieldType: f.field_type, required: f.required })) ?? []
          }
        />
      </div>
    </main>
  );
}
