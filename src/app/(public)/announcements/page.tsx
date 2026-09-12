import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/site/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Pin } from "lucide-react";
import { pageMetadata } from "@/lib/page-metadata";
import { formatDateTime } from "@/lib/date";

export const metadata = pageMetadata({
  title: "Announcements",
  description: "Official updates and announcements from the Zing Hackathon organizers.",
  path: "/announcements",
});

export default async function AnnouncementsPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("event_id", event.id)
    .not("published_at", "is", null)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  const list = (announcements as unknown as { id: string; title: string; body: string; published_at: string; is_pinned: boolean }[] | null) ?? [];

  return (
    <main>
      <PageHeader eyebrow="Stay in the loop" title="Announcements" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 sm:px-6">
        {list.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Megaphone className="mx-auto mb-3 h-8 w-8" />
            <p>No announcements yet. Check back soon.</p>
          </div>
        ) : (
          list.map((a) => (
            <Card key={a.id} className={a.is_pinned ? "border-primary/40" : undefined}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  {a.is_pinned && (
                    <Badge variant="secondary">
                      <Pin className="h-3 w-3" /> Pinned
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{a.title}</CardTitle>
                <CardDescription>{formatDateTime(a.published_at)}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{a.body}</CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
