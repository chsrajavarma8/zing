"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { MESSAGES } from "@/lib/messages";

// `error` (the actual Error object, possibly with a server stack trace via
// `digest`) is deliberately never rendered here - only a generic message.
// Never surface error.message/stack/digest to the user; that's exactly the
// kind of internal detail (query text, file paths, occasionally secrets in
// a thrown value) this boundary exists to keep off the page.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative">
        <AlertTriangle className="mx-auto mb-6 h-10 w-10 text-destructive" aria-hidden />
        <h1 className="font-heading text-3xl font-bold">{MESSAGES.error}</h1>
        <p className="mt-2 text-muted-foreground">Your data is safe: nothing was lost.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
