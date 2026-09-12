import { AlertTriangle } from "lucide-react";

// Shown instead of silently rendering a blank page whenever no published
// event exists yet - e.g. before database migrations are applied, or before
// an admin has published the event. Never invent placeholder event content.
export function EventNotConfigured() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-8 w-8 text-muted-foreground" />
      <h1 className="font-heading text-2xl font-bold">No event configured yet</h1>
      <p className="mt-2 text-muted-foreground">
        An admin needs to configure and publish an event before this page has anything to show.
      </p>
    </main>
  );
}
