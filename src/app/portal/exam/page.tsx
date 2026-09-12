import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

// Bridge route: the screening exam always lives on the Minor round, so send
// participants straight to /portal/exam/[roundId] instead of making them
// hunt for the round id.
export default async function ExamLandingPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: minorRound } = await supabase
    .from("rounds")
    .select("id")
    .eq("event_id", portal.event.id)
    .eq("key", "minor")
    .maybeSingle();

  const roundId = (minorRound as unknown as { id: string } | null)?.id;
  if (roundId) redirect(`/portal/exam/${roundId}`);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
        <FileQuestion className="h-8 w-8" />
        <p>The screening round hasn&apos;t been configured for this event yet.</p>
      </CardContent>
    </Card>
  );
}
