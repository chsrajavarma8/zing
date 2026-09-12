import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Tokenized ID-card verification link - never indexed, never listed in the
// sitemap. robots.txt already disallows /verify/ as a crawl courtesy; this
// noindex tag is the stronger signal search engines honor even if a link
// to a specific token URL is discovered some other way.
export const metadata: Metadata = { robots: { index: false, follow: false } };
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";

export default async function VerifyIdCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_id_card", { token });
  const result = Array.isArray(data) ? data[0] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="items-center">
          <Sparkles className="mb-2 h-6 w-6 text-primary" />
          <CardTitle>ID Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
              <XCircle className="h-10 w-10" />
              <p>This ID card could not be verified.</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {result.valid ? (
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              ) : (
                <XCircle className="mx-auto h-10 w-10 text-destructive" />
              )}
              <p className="text-lg font-semibold">{result.full_name}</p>
              <p className="text-sm text-muted-foreground">{result.team_name} · {result.event_name}</p>
              <Badge variant="secondary" className="capitalize">{result.role}</Badge>
              <p className="font-mono text-xs text-muted-foreground">{result.reference_id}</p>
              <Badge variant={result.valid ? "default" : "destructive"}>{result.valid ? "Valid" : "Revoked"}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
