import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Info } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import type { Round } from "@/types/database";

export default async function PortalSchedulePage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  const supabase = await createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", portal.event.id).order("order_index");
  const roundList = (rounds as unknown as Round[] | null) ?? [];

  const items = [
    portal.event.registration_close_at && { label: "Registration closes", at: portal.event.registration_close_at },
    ...roundList.flatMap((r) => [
      r.starts_at && { label: `${r.name} begins / submission window opens`, at: r.starts_at },
      r.ends_at && { label: `${r.name} ends / submission deadline`, at: r.ends_at },
    ]),
  ].filter(Boolean) as { label: string; at: string }[];

  items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Info className="h-3.5 w-3.5" /> All times shown in Indian Standard Time (IST).
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => {
          const past = Date.parse(item.at) < Date.now();
          return (
            <Card key={i} className={past ? "opacity-60" : "card-glow"}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {past && <Badge variant="secondary">Past</Badge>}
                  <span className="text-sm text-muted-foreground">{formatDateTime(item.at)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
