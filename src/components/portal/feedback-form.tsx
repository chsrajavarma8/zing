"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { submitFeedback } from "@/app/portal/feedback/actions";
import { cn } from "@/lib/utils";

const RATING_FIELDS = [
  { key: "overall", label: "Overall experience" },
  { key: "registration", label: "Registration experience" },
  { key: "portal", label: "Portal usability" },
  { key: "communication", label: "Communication" },
] as const;

type RatingKey = (typeof RATING_FIELDS)[number]["key"];

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} star`} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)} className="p-1">
            <Star className={cn("h-6 w-6 transition-colors", (hover || value) >= n ? "fill-primary text-primary" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FeedbackForm({ eventId, teamId }: { eventId: string; teamId: string }) {
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({ overall: 0, registration: 0, portal: 0, communication: 0 });
  const [whatWorkedWell, setWhatWorkedWell] = useState("");
  const [whatCouldImprove, setWhatCouldImprove] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        <p className="font-medium">Thank you. Your feedback has been recorded.</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ratings.overall === 0) {
      toast.error("Please rate your overall experience.");
      return;
    }
    setBusy(true);
    const result = await submitFeedback(eventId, teamId, {
      overallRating: ratings.overall,
      registrationExperienceRating: ratings.registration,
      portalUsabilityRating: ratings.portal,
      communicationRating: ratings.communication,
      whatWorkedWell,
      whatCouldImprove,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not submit feedback.");
      return;
    }
    setDone(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground">
        This feedback is linked to your participant account, not anonymous, so organizers can follow up if needed.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {RATING_FIELDS.map((f) => (
          <StarRating key={f.key} label={f.label} value={ratings[f.key]} onChange={(v) => setRatings((r) => ({ ...r, [f.key]: v }))} />
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="worked">What worked well?</Label>
        <Textarea id="worked" rows={3} value={whatWorkedWell} onChange={(e) => setWhatWorkedWell(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="improve">What could improve?</Label>
        <Textarea id="improve" rows={3} value={whatCouldImprove} onChange={(e) => setWhatCouldImprove(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy} className="glow-primary">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit feedback
      </Button>
    </form>
  );
}
