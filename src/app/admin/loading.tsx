import { Loader2 } from "lucide-react";

// Next.js shows this automatically while an /admin route segment loads.
export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" />
      <p className="text-sm">Loading…</p>
    </div>
  );
}
