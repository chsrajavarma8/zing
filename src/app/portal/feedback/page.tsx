import { getPortalContext } from "@/lib/portal/data";
import { FeedbackForm } from "@/components/portal/feedback-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function FeedbackPage() {
  const portal = await getPortalContext();
  if (!portal) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Tell us about your experience.</h1>
        <p className="text-muted-foreground">Help Skillglider improve future hackathons.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share your feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <FeedbackForm eventId={portal.event.id} teamId={portal.team.id} />
        </CardContent>
      </Card>
    </div>
  );
}
