"use client";

import { Children, cloneElement, isValidElement, useId, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Lock, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { updateEvent } from "@/app/admin/events/actions";
import { toISTDatetimeLocalValue, fromISTDatetimeLocalValue } from "@/lib/date";
import { isValidWhatsappGroupUrl } from "@/lib/whatsapp";
import { directUpload } from "@/lib/direct-upload";
import type { Event, Json } from "@/types/database";
import { useRef } from "react";
import { useRouter } from "next/navigation";

const toDatetimeLocal = toISTDatetimeLocalValue;
const fromDatetimeLocal = fromISTDatetimeLocalValue;

export function EventConfigForm({ event, readOnly }: { event: Event; readOnly: boolean }) {
  const [values, setValues] = useState({
    name: event.name,
    organizer_name: event.organizer_name,
    tagline: event.tagline ?? "",
    description: event.description ?? "",
    prize_pool_label: event.prize_pool_label,
    start_date: event.start_date ?? "",
    end_date: event.end_date ?? "",
    registration_open_at: toDatetimeLocal(event.registration_open_at),
    registration_close_at: toDatetimeLocal(event.registration_close_at),
    team_lock_at: toDatetimeLocal(event.team_lock_at),
    timezone: event.timezone,
    team_size_min: event.team_size_min,
    team_size_max: event.team_size_max,
    support_email: event.support_email,
    support_phone: event.support_phone,
    support_website: event.support_website ?? "",
    community_base_count: event.community_base_count,
    problem_statement_mode: event.problem_statement_mode,
    problem_statement_text: event.problem_statement_text ?? "",
    allow_gender_field: event.allow_gender_field,
    gender_field_required: event.gender_field_required,
    status: event.status,
    whatsapp_group_url: event.whatsapp_group_url ?? "",
    whatsapp_group_enabled: event.whatsapp_group_enabled,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(key: K, v: (typeof values)[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateEvent(event.id, {
      ...values,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      registration_open_at: fromDatetimeLocal(values.registration_open_at),
      registration_close_at: fromDatetimeLocal(values.registration_close_at),
      team_lock_at: fromDatetimeLocal(values.team_lock_at),
      problem_statement_text: values.problem_statement_text || null,
      support_website: values.support_website || null,
      whatsapp_group_url: values.whatsapp_group_url.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save.");
      return;
    }
    toast.success("Event updated");
  }

  return (
    <Card>
      {readOnly && (
        <div className="p-4 pb-0">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>You have read-only access. Reviewers cannot edit event configuration.</AlertDescription>
          </Alert>
        </div>
      )}
      <CardContent className="pt-6">
        <Tabs defaultValue="basics">
          <TabsList className="mb-4 max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="dates">Dates & Team Size</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="problem">Problem Statement</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Group</TabsTrigger>
            <TabsTrigger value="publish">Publish</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="grid gap-4 sm:grid-cols-2">
            <Field label="Event name">
              <Input disabled={readOnly} value={values.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Organizer name">
              <Input disabled={readOnly} value={values.organizer_name} onChange={(e) => set("organizer_name", e.target.value)} />
            </Field>
            <Field label="Tagline">
              <Input disabled={readOnly} value={values.tagline} onChange={(e) => set("tagline", e.target.value)} />
            </Field>
            <Field label="Prize pool label">
              <Input disabled={readOnly} value={values.prize_pool_label} onChange={(e) => set("prize_pool_label", e.target.value)} />
            </Field>
            <Field label="Description" full>
              <Textarea disabled={readOnly} rows={4} value={values.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Logo" full controlId="branding-logo-file">
              <BrandingLogoUpload branding={event.branding} readOnly={readOnly} />
            </Field>
          </TabsContent>

          <TabsContent value="dates" className="grid gap-4 sm:grid-cols-2">
            <Field label="Event start date">
              <Input type="date" disabled={readOnly} value={values.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} />
            </Field>
            <Field label="Event end date">
              <Input type="date" disabled={readOnly} value={values.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} />
            </Field>
            <Field label="Registration opens (IST)">
              <Input type="datetime-local" disabled={readOnly} value={values.registration_open_at} onChange={(e) => set("registration_open_at", e.target.value)} />
            </Field>
            <Field label="Registration closes (IST)">
              <Input type="datetime-local" disabled={readOnly} value={values.registration_close_at} onChange={(e) => set("registration_close_at", e.target.value)} />
            </Field>
            <Field label="Team changes lock at (IST)" full>
              <Input type="datetime-local" disabled={readOnly} value={values.team_lock_at} onChange={(e) => set("team_lock_at", e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Once this passes, teams can no longer add/remove members, rename the team, transfer leadership, or
                change delegate submission access. Submissions during an open round window are not affected. Leave
                blank to not lock team changes yet.
              </p>
            </Field>
            <Field label="Timezone">
              <Input disabled={readOnly} value={values.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="Asia/Kolkata" />
            </Field>
            <Field label="Community base count">
              <Input
                type="number"
                disabled={readOnly}
                value={values.community_base_count}
                onChange={(e) => set("community_base_count", Number(e.target.value))}
              />
            </Field>
            <Field label="Min team size">
              <Input type="number" min={1} disabled={readOnly} value={values.team_size_min} onChange={(e) => set("team_size_min", Number(e.target.value))} />
            </Field>
            <Field label="Max team size">
              <Input type="number" min={1} disabled={readOnly} value={values.team_size_max} onChange={(e) => set("team_size_max", Number(e.target.value))} />
            </Field>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="event-allow-gender" disabled={readOnly} checked={values.allow_gender_field} onCheckedChange={(v) => set("allow_gender_field", v)} />
              <Label htmlFor="event-allow-gender" className="font-normal">Show gender field at registration</Label>
            </div>
            {values.allow_gender_field && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch id="event-require-gender" disabled={readOnly} checked={values.gender_field_required} onCheckedChange={(v) => set("gender_field_required", v)} />
                <Label htmlFor="event-require-gender" className="font-normal">Require gender field (optional by default)</Label>
              </div>
            )}
          </TabsContent>

          <TabsContent value="contact" className="grid gap-4 sm:grid-cols-2">
            <Field label="Support email">
              <Input disabled={readOnly} value={values.support_email} onChange={(e) => set("support_email", e.target.value)} />
            </Field>
            <Field label="Support phone">
              <Input disabled={readOnly} value={values.support_phone} onChange={(e) => set("support_phone", e.target.value)} />
            </Field>
            <Field label="Website (optional)" full>
              <Input disabled={readOnly} value={values.support_website} onChange={(e) => set("support_website", e.target.value)} placeholder="https://example.com" />
            </Field>
          </TabsContent>

          <TabsContent value="problem" className="space-y-4">
            <Field label="Problem statement mode" controlId="event-problem-mode">
              <Select
                disabled={readOnly}
                value={values.problem_statement_mode}
                onValueChange={(v) => set("problem_statement_mode", v as typeof values.problem_statement_mode)}
              >
                <SelectTrigger id="event-problem-mode" className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self_identified">Self-identified (default): teams choose their own</SelectItem>
                  <SelectItem value="organizer_provided">Organizer-provided</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {values.problem_statement_mode === "organizer_provided" && (
              <Field label="Problem statement text" full>
                <Textarea disabled={readOnly} rows={4} value={values.problem_statement_text} onChange={(e) => set("problem_statement_text", e.target.value)} />
              </Field>
            )}
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4">
            <Field label="Group invite link" full>
              <Input
                disabled={readOnly}
                value={values.whatsapp_group_url}
                onChange={(e) => set("whatsapp_group_url", e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
              />
            </Field>
            <div className="flex items-center gap-2">
              <Switch
                id="event-whatsapp-enabled"
                disabled={readOnly || !isValidWhatsappGroupUrl(values.whatsapp_group_url)}
                checked={values.whatsapp_group_enabled}
                onCheckedChange={(v) => set("whatsapp_group_enabled", v)}
              />
              <Label htmlFor="event-whatsapp-enabled" className="font-normal">Show &ldquo;Join WhatsApp Group&rdquo; button</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Shown on the registration confirmation page and participant dashboard once a valid link is set and
              enabled here. This is a group invite only - WhatsApp is not used to send notifications.
            </p>
          </TabsContent>

          <TabsContent value="publish" className="space-y-4">
            <Field label="Status" controlId="event-status">
              <Select disabled={readOnly} value={values.status} onValueChange={(v) => set("status", v as typeof values.status)}>
                <SelectTrigger id="event-status" className="w-full sm:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (hidden from public)</SelectItem>
                  <SelectItem value="published">Published (live)</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="text-sm text-muted-foreground">
              Only published events show on the public site and accept registrations.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
      {!readOnly && (
        <CardFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function BrandingLogoUpload({ branding, readOnly }: { branding: Json; readOnly: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const logoUrl = (branding as { logo_url?: string } | null)?.logo_url;

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    const result = await directUpload({
      bucket: "branding",
      file,
      urlEndpoint: "/api/admin/uploads/url",
      completeEndpoint: "/api/admin/uploads/complete",
      extra: { kind: "branding" },
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Logo updated");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Event logo" className="h-12 w-12 rounded-md border object-contain" />
      )}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <label htmlFor="branding-logo-file" className="sr-only">
            Event logo image (PNG, JPEG, or WebP, up to 5 MB)
          </label>
          <input id="branding-logo-file" ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
          <Button type="button" size="sm" variant="outline" onClick={upload} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload
          </Button>
        </div>
      )}
    </div>
  );
}

// Associates the label with the field's control (BUG-017): the first child,
// when it's an Input or Textarea, receives the generated id. Select fields
// pass `controlId` through to their SelectTrigger instead.
function Field({ label, full, children, controlId }: { label: string; full?: boolean; children: React.ReactNode; controlId?: string }) {
  const generated = useId();
  const id = controlId ?? generated;
  const content = Children.map(children, (child, i) =>
    i === 0 && isValidElement<{ id?: string }>(child) && (child.type === Input || child.type === Textarea) ? cloneElement(child, { id }) : child,
  );
  return (
    <div className={`space-y-2 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {content}
    </div>
  );
}
