import { Loader2 } from "lucide-react";

// Next.js shows this automatically while a /portal route segment loads.
// motion-reduce:animate-none respects prefers-reduced-motion directly, since
// this spin isn't handled by the Reveal wrapper.
export default function PortalLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" />
      <p className="text-sm">Loading…</p>
    </div>
  );
}
