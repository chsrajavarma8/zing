"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertAnnouncement, deleteAnnouncement } from "@/app/admin/content/actions";
import type { Announcement } from "@/types/database";

export function AnnouncementsEditor({ eventId, announcements }: { eventId: string; announcements: Announcement[] }) {
  const [items, setItems] = useState(announcements);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    const result = await upsertAnnouncement(eventId, { title, body, isPinned: false, published: true });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save.");
      return;
    }
    toast.success("Announcement published");
    setTitle("");
    setBody("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Input aria-label="New announcement title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea aria-label="New announcement message" placeholder="Body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button onClick={add} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Publish announcement
          </Button>
        </CardContent>
      </Card>

      {items.map((a) => (
        <AnnouncementRow key={a.id} announcement={a} eventId={eventId} onDeleted={() => setItems((s) => s.filter((x) => x.id !== a.id))} />
      ))}
    </div>
  );
}

function AnnouncementRow({ announcement, eventId, onDeleted }: { announcement: Announcement; eventId: string; onDeleted: () => void }) {
  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);
  const [isPinned, setIsPinned] = useState(announcement.is_pinned);
  const [published, setPublished] = useState(Boolean(announcement.published_at));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await upsertAnnouncement(eventId, { id: announcement.id, title, body, isPinned, published });
    setSaving(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else toast.success("Saved");
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2">
          <Input aria-label="Announcement title" value={title} onChange={(e) => setTitle(e.target.value)} />
          {isPinned && <Badge variant="secondary">Pinned</Badge>}
        </div>
        <Textarea aria-label="Announcement message" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={published} onCheckedChange={setPublished} /> Published
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isPinned} onCheckedChange={setIsPinned} /> Pinned
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete announcement: ${title || "untitled"}`}
              onClick={async () => {
                const result = await deleteAnnouncement(eventId, announcement.id);
                if (result.ok) onDeleted();
                else toast.error(result.error);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
