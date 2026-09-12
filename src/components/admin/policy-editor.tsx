"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { publishPolicyVersion } from "@/app/admin/content/actions";

interface Policy {
  id: string;
  type: string;
  version: string;
  content_markdown: string;
  is_current: boolean;
  published_at: string | null;
}

export function PolicyEditor({ eventId, policies }: { eventId: string; policies: Policy[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <PolicyTypeEditor eventId={eventId} type="rules" label="Rules and Regulations" policies={policies.filter((p) => p.type === "rules")} />
      <PolicyTypeEditor eventId={eventId} type="privacy" label="Privacy Policy" policies={policies.filter((p) => p.type === "privacy")} />
      <PolicyTypeEditor eventId={eventId} type="terms" label="Terms and Conditions" policies={policies.filter((p) => p.type === "terms")} />
    </div>
  );
}

function PolicyTypeEditor({ eventId, type, label, policies }: { eventId: string; type: "privacy" | "terms" | "rules"; label: string; policies: Policy[] }) {
  const current = policies.find((p) => p.is_current);
  const [version, setVersion] = useState("");
  const [content, setContent] = useState(current?.content_markdown ?? "");
  const [busy, setBusy] = useState(false);

  async function publish() {
    if (!version.trim()) {
      toast.error("Give this version a label, e.g. 1.0");
      return;
    }
    setBusy(true);
    const result = await publishPolicyVersion(eventId, type, version.trim(), content);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not publish.");
      return;
    }
    toast.success(`Published version ${version}`);
    setVersion("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{current ? `Current: v${current.version}` : "Not published yet"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current?.version.startsWith("draft") && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Draft content</AlertTitle>
            <AlertDescription>This is placeholder text pending organizer/legal review: it is not a legally approved policy.</AlertDescription>
          </Alert>
        )}
        <Textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-sm" />
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Version label, e.g. 1.0" value={version} onChange={(e) => setVersion(e.target.value)} className="w-48" />
          <Button onClick={publish} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Publish new version
          </Button>
        </div>
        {policies.length > 0 && (
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Version history</p>
            {policies.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={p.is_current ? "default" : "outline"} className="text-[10px]">v{p.version}</Badge>
                {p.published_at && new Date(p.published_at).toLocaleDateString()}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
