"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RoundEditor } from "@/components/admin/round-editor";
import type { Round } from "@/types/database";

const LABELS: Record<string, string> = { minor: "Talent", intermediate: "Intermediate", major: "Major" };

// One compact tabbed section instead of three always-expanded, near-identical
// cards stacked on the page - only the selected round's editor is shown.
export function RoundManagementTabs({ rounds, eventId, readOnly }: { rounds: Round[]; eventId: string; readOnly: boolean }) {
  if (rounds.length === 0) {
    return <p className="text-muted-foreground">No rounds configured yet.</p>;
  }

  return (
    <Tabs defaultValue={rounds[0].key}>
      <TabsList className="max-w-full justify-start overflow-x-auto">
        {rounds.map((r) => (
          <TabsTrigger key={r.id} value={r.key}>
            {LABELS[r.key] ?? r.key}
          </TabsTrigger>
        ))}
      </TabsList>
      {rounds.map((r) => (
        <TabsContent key={r.id} value={r.key} className="pt-4">
          <RoundEditor round={r} eventId={eventId} readOnly={readOnly} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
