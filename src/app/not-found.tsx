import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { MESSAGES } from "@/lib/messages";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative">
        <Compass className="mx-auto mb-6 h-10 w-10 text-primary" aria-hidden />
        <h1 className="font-heading text-3xl font-bold">{MESSAGES.notFound}</h1>
        <p className="mt-2 text-muted-foreground">The link may have changed or the page may no longer be available.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">Go to home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
