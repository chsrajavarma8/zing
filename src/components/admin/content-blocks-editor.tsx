"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveContentBlock } from "@/app/admin/content/actions";

const BLOCKS: { key: string; label: string; fields: { name: string; label: string; multiline?: boolean }[] }[] = [
  { key: "hero", label: "Homepage hero", fields: [{ name: "headline", label: "Headline" }, { name: "subheadline", label: "Subheadline", multiline: true }] },
  { key: "about", label: "About section", fields: [{ name: "body", label: "Body", multiline: true }] },
  { key: "eligibility", label: "Eligibility", fields: [{ name: "body", label: "Body", multiline: true }] },
  {
    key: "prizes",
    label: "Prizes page",
    fields: [
      { name: "body", label: "Intro body", multiline: true },
      { name: "tier1_label", label: "1st place label" },
      { name: "tier1_amount", label: "1st place amount" },
      { name: "tier2_label", label: "2nd place label" },
      { name: "tier2_amount", label: "2nd place amount" },
      { name: "tier3_label", label: "3rd place label" },
      { name: "tier3_amount", label: "3rd place amount" },
    ],
  },
  { key: "rules", label: "Rules page body", fields: [{ name: "body", label: "Body (Markdown supported)", multiline: true }] },
  { key: "problem_statement", label: "Problem statement note", fields: [{ name: "body", label: "Body", multiline: true }] },
];

export function ContentBlocksEditor({ eventId, blocks }: { eventId: string; blocks: Map<string, Record<string, string>> }) {
  return (
    <div className="space-y-4">
      {BLOCKS.map((b) => (
        <BlockCard key={b.key} eventId={eventId} blockKey={b.key} label={b.label} fields={b.fields} initial={blocks.get(b.key) ?? {}} />
      ))}
    </div>
  );
}

function BlockCard({
  eventId,
  blockKey,
  label,
  fields,
  initial,
}: {
  eventId: string;
  blockKey: string;
  label: string;
  fields: { name: string; label: string; multiline?: boolean }[];
  initial: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f.name] = initial[f.name] ?? "";
    return v;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await saveContentBlock(eventId, blockKey, values);
    setSaving(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else toast.success("Saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((f) => (
          <div key={f.name} className="space-y-2">
            <Label>{f.label}</Label>
            {f.multiline ? (
              <Textarea rows={4} value={values[f.name]} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
            ) : (
              <Input value={values[f.name]} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
            )}
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </CardFooter>
    </Card>
  );
}
