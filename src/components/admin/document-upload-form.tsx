"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { directUpload } from "@/lib/direct-upload";

const TYPES = [
  { value: "rules", label: "Rules & Regulations" },
  { value: "submission_instructions", label: "Submission Instructions" },
  { value: "presentation_guidelines", label: "Presentation Guidelines" },
  { value: "exhibit_request", label: "Exhibit Request Instructions" },
  { value: "organizer_published", label: "Organizer Published" },
];

export function DocumentUploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("organizer_published");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) {
      toast.error("Choose a file and give it a title.");
      return;
    }
    setBusy(true);
    const result = await directUpload({
      bucket: "documents",
      file,
      urlEndpoint: "/api/admin/uploads/url",
      completeEndpoint: "/api/admin/uploads/complete",
      extra: { kind: "document", title: title.trim(), docType: type },
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Document uploaded");
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload a document</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="doc-upload-type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="doc-upload-type" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-upload-title">Title</Label>
          <Input id="doc-upload-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-56 max-w-full" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-upload-file">File (PDF, PNG, JPG: max 25MB)</Label>
          <Input id="doc-upload-file" type="file" ref={fileRef} accept=".pdf,.png,.jpg,.jpeg" />
        </div>
        <Button onClick={upload} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Upload
        </Button>
      </CardContent>
    </Card>
  );
}
