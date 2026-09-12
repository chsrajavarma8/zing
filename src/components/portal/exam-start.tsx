"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, PlayCircle, Wifi } from "lucide-react";

export function ExamStart({ examId }: { examId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start the assessment.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Alert>
        <Wifi className="h-4 w-4" />
        <AlertDescription>
          Make sure your connection is stable and allow enough uninterrupted time to complete the assessment.
        </AlertDescription>
      </Alert>
      <div className="flex items-center gap-2">
        <Checkbox id="ack" checked={acknowledged} onCheckedChange={(v) => setAcknowledged(Boolean(v))} />
        <Label htmlFor="ack" className="font-normal">
          I have read the assessment instructions.
        </Label>
      </div>
      <Button onClick={start} disabled={busy || !acknowledged} size="lg" className="glow-primary">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
        Start assessment
      </Button>
      <p className="text-xs text-muted-foreground">
        Once started, the timer cannot be paused. Your answers save automatically as you work.
      </p>
    </div>
  );
}
