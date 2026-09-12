"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertFaq, deleteFaq } from "@/app/admin/content/actions";
import type { Faq } from "@/types/database";

export function FaqEditor({ eventId, faqs }: { eventId: string; faqs: Faq[] }) {
  const [items, setItems] = useState(faqs);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [busy, setBusy] = useState(false);

  async function addFaq() {
    if (!newQ.trim() || !newA.trim()) return;
    setBusy(true);
    const result = await upsertFaq(eventId, { question: newQ, answer: newA, orderIndex: items.length, published: true });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save.");
      return;
    }
    toast.success("FAQ added");
    setNewQ("");
    setNewA("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Input placeholder="Question" value={newQ} onChange={(e) => setNewQ(e.target.value)} />
          <Textarea placeholder="Answer" rows={3} value={newA} onChange={(e) => setNewA(e.target.value)} />
          <Button onClick={addFaq} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add FAQ
          </Button>
        </CardContent>
      </Card>

      {items.map((f, i) => (
        <FaqRow key={f.id} faq={f} eventId={eventId} onDeleted={() => setItems((s) => s.filter((x) => x.id !== f.id))} orderIndex={i} />
      ))}
    </div>
  );
}

function FaqRow({ faq, eventId, onDeleted, orderIndex }: { faq: Faq; eventId: string; onDeleted: () => void; orderIndex: number }) {
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);
  const [published, setPublished] = useState(faq.published);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await upsertFaq(eventId, { id: faq.id, question, answer, orderIndex, published });
    setSaving(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
    else toast.success("Saved");
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={published} onCheckedChange={setPublished} /> Published
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const result = await deleteFaq(faq.id);
                if (result.ok) onDeleted();
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
