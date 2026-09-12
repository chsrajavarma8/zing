"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Sparkles } from "lucide-react";

export function IdCardView({
  token,
  revoked,
  fullName,
  teamName,
  eventName,
  role,
  referenceId,
}: {
  token: string;
  revoked: boolean;
  fullName: string;
  teamName: string;
  eventName: string;
  role: string;
  referenceId: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = `${window.location.origin}/verify/${token}`;
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(null));
  }, [token]);

  return (
    <div className="space-y-4">
      <div ref={printRef} id="id-card-print-area">
        <Card className="card-glow mx-auto max-w-sm overflow-hidden border-primary/30">
          <div
            className="h-2 w-full"
            style={{ background: "linear-gradient(90deg, var(--brand-from), var(--brand-via), var(--brand-to))" }}
          />
          <CardContent className="space-y-4 py-6 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> {eventName}
            </div>
            <div>
              <p className="text-xl font-bold">{fullName}</p>
              <p className="text-sm text-muted-foreground">{teamName}</p>
            </div>
            <Badge variant="secondary" className="capitalize">{role}</Badge>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR verification code" className="mx-auto h-40 w-40" />
            )}
            <p className="font-mono text-xs text-muted-foreground">{referenceId}</p>
            {revoked && <Badge variant="destructive">Revoked</Badge>}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Download ID card
        </Button>
        <p className="text-xs text-muted-foreground">Opens your browser&apos;s print dialog: choose &ldquo;Save as PDF&rdquo; to download.</p>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #id-card-print-area, #id-card-print-area * { visibility: visible; }
          #id-card-print-area { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
