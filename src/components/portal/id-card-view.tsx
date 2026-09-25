"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function IdCardView({
  verifyBaseUrl,
  isCanonicalOrigin,
  token,
  revoked,
  fullName,
  teamName,
  teamReferenceId,
  eventName,
  organizerName,
  role,
  referenceId,
}: {
  verifyBaseUrl: string;
  isCanonicalOrigin: boolean;
  token: string;
  revoked: boolean;
  fullName: string;
  teamName: string;
  teamReferenceId: string;
  eventName: string;
  organizerName: string;
  role: string;
  referenceId: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // The QR encodes the configured canonical origin, never whatever host this
  // page happens to be served from (RISK-006).
  useEffect(() => {
    const url = `${verifyBaseUrl}/verify/${encodeURIComponent(token)}`;
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(null));
  }, [token, verifyBaseUrl]);

  // Renders ONLY the card element itself (not the page/nav/buttons) to a PNG
  // and triggers a real one-click file download - no print dialog, no
  // manual "Save as PDF" step.
  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${referenceId || "id-card"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Could not generate the ID card image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      {!isCanonicalOrigin && (
        <p role="note" className="max-w-[340px] rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          Test card: this QR code points to {verifyBaseUrl}, not the production site. Don&apos;t print it for the event.
        </p>
      )}
      <div ref={cardRef} className="inline-block w-full max-w-[340px] bg-white p-1">
        <Card className="card-glow mx-auto w-full overflow-hidden border-primary/30">
          <div
            className="h-2 w-full"
            style={{ background: "linear-gradient(90deg, var(--brand-from), var(--brand-via), var(--brand-to))" }}
          />
          <CardContent className="space-y-4 py-6 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> {eventName}
            </div>
            <p className="text-xs text-muted-foreground">{organizerName}</p>
            <div>
              <p className="text-xl font-bold">{fullName}</p>
              <p className="text-sm text-muted-foreground">{teamName}</p>
            </div>
            <Badge variant="secondary" className="capitalize">{role}</Badge>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR verification code" className="mx-auto h-40 w-40" crossOrigin="anonymous" />
            )}
            <div className="space-y-0.5">
              <p className="font-mono text-xs text-muted-foreground">Participant: {referenceId}</p>
              <p className="font-mono text-xs text-muted-foreground">Team ID: {teamReferenceId}</p>
            </div>
            {revoked ? (
              <Badge variant="destructive">
                <ShieldX className="mr-1 h-3 w-3" /> Revoked
              </Badge>
            ) : (
              <Badge>
                <ShieldCheck className="mr-1 h-3 w-3" /> Verified
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Button variant="outline" onClick={handleDownload} disabled={downloading || !qr}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download ID card
        </Button>
        <p className="text-xs text-muted-foreground">Downloads just the card above as a PNG image.</p>
      </div>
    </div>
  );
}
