"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertRegistrationField, deleteRegistrationField, type RegistrationFieldInput } from "@/app/admin/events/fields-actions";

interface Field {
  id: string;
  key: string;
  label: string;
  field_type: RegistrationFieldInput["fieldType"];
  required: boolean;
  options: string[];
  order_index: number;
  active: boolean;
}

export function RegistrationFieldsManager({ eventId, fields, readOnly }: { eventId: string; fields: Field[]; readOnly: boolean }) {
  const [items, setItems] = useState(fields);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<RegistrationFieldInput["fieldType"]>("text");
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!key.trim() || !label.trim()) return;
    setBusy(true);
    const result = await upsertRegistrationField(eventId, {
      key,
      label,
      fieldType,
      required,
      options: [],
      orderIndex: items.length,
      active: true,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save.");
      return;
    }
    toast.success("Field added: appears on the registration form immediately.");
    setKey("");
    setLabel("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom registration fields</CardTitle>
        <CardDescription>Extra fields collected once per team at registration, beyond the standard participant fields.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div>
              <p className="font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">
                key: {f.key} · {f.field_type} {f.required && "· required"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!f.active && <Badge variant="outline">Inactive</Badge>}
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete field ${f.label}`}
                  onClick={async () => {
                    const result = await deleteRegistrationField(f.id);
                    if (result.ok) setItems((s) => s.filter((x) => x.id !== f.id));
                    else toast.error(result.error ?? "Could not delete.");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No custom fields configured.</p>}

        {!readOnly && (
          <div className="flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Key</label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="t_shirt_size" className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="T-shirt size" className="w-48" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as RegistrationFieldInput["fieldType"])}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={required} onCheckedChange={setRequired} /> Required
            </label>
            <Button onClick={add} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add field
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
