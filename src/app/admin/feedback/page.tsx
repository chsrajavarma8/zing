import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquareHeart } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import type { FeedbackRow } from "@/types/database";

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ rating?: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const sp = await searchParams;
  const ratingFilter = sp.rating ? Number(sp.rating) : null;

  const supabase = await createClient();
  let query = supabase
    .from("feedback")
    .select("*, profiles(full_name, email), teams(team_name)")
    .eq("event_id", ctx.event.id)
    .order("created_at", { ascending: false });
  if (ratingFilter) query = query.eq("rating", ratingFilter);

  const { data: feedback } = await query;

  const list = (feedback as unknown as (FeedbackRow & { profiles: { full_name: string | null; email: string } | null; teams: { team_name: string } | null })[] | null) ?? [];
  const avg = list.length > 0 ? list.reduce((s, f) => s + (f.rating ?? 0), 0) / list.filter((f) => f.rating != null).length : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold">Participant feedback</h1>
          <p className="text-muted-foreground">Review event feedback and identify areas to improve. {list.length} responses.</p>
        </div>
        {avg !== null && (
          <div className="flex items-center gap-1 text-lg font-semibold">
            <Star className="h-5 w-5 fill-primary text-primary" /> {avg.toFixed(1)} avg overall
          </div>
        )}
      </div>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <select name="rating" defaultValue={sp.rating ?? ""} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
          Filter
        </button>
      </form>

      <div className="space-y-3">
        {list.map((f) => (
          <Card key={f.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {f.teams?.team_name} · {f.profiles?.full_name || f.profiles?.email}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(f.created_at)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <RatingBadge label="Overall" value={f.rating} />
                <RatingBadge label="Registration" value={f.registration_experience_rating} />
                <RatingBadge label="Portal" value={f.portal_usability_rating} />
                <RatingBadge label="Communication" value={f.communication_rating} />
              </div>
              {f.what_worked_well && (
                <p className="text-sm">
                  <span className="font-medium">Worked well:</span> {f.what_worked_well}
                </p>
              )}
              {f.what_could_improve && (
                <p className="text-sm">
                  <span className="font-medium">Could improve:</span> {f.what_could_improve}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <MessageSquareHeart className="mx-auto mb-3 h-8 w-8" />
            <p>No feedback has been submitted yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingBadge({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <Badge variant="secondary" className="gap-1">
      {label}: {value}/5
    </Badge>
  );
}
