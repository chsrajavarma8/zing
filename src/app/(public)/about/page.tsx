import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/site/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, FileText, Layers, Building2, ExternalLink, Mail } from "lucide-react";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "About",
  description: "Learn about Zing Hackathon by Skillglider: who it's for, how it works, and what to expect across the event.",
  path: "/about",
});

export default async function AboutPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: about } = await supabase
    .from("content_blocks")
    .select("content")
    .eq("event_id", event.id)
    .eq("key", "about")
    .maybeSingle();

  const aboutBody = (about?.content as { body?: string } | null)?.body;

  return (
    <main>
      <PageHeader eyebrow="About" title={`About ${event.name}`} />

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="pt-6 text-lg text-muted-foreground">
            <p>
              {aboutBody ||
                `Organized by ${event.organizer_name}, ${event.name} is a platform for student teams to turn their ideas into practical projects.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading">Start with a problem you understand.</CardTitle>
          </CardHeader>
          <CardContent className="text-base text-muted-foreground">
            {event.problem_statement_mode === "organizer_provided" && event.problem_statement_text ? (
              <p>{event.problem_statement_text}</p>
            ) : (
              <p>
                There is no fixed organizer-provided problem statement. Your team identifies the challenge, explains
                why it matters, and develops a solution.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading">Show your thinking and your execution.</CardTitle>
          </CardHeader>
          <CardContent className="text-base text-muted-foreground">
            <p>Use your submissions to explain the problem, demonstrate your solution, and describe the technical decisions behind your project.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading">A journey across three rounds.</CardTitle>
          </CardHeader>
          <CardContent className="text-base text-muted-foreground">
            <p>The event progresses through Talent, Intermediate, and Major rounds. Follow the published instructions and qualification requirements for each stage.</p>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading">Organizer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base text-muted-foreground">
              {event.name} is organized by {event.organizer_name}.
            </p>
            <div className="flex flex-wrap gap-3">
              {event.support_website && (
                <Button variant="outline" asChild>
                  <a href={event.support_website} target="_blank" rel="noopener noreferrer">
                    Visit {event.organizer_name} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              <Button variant="outline" asChild>
                <a href={`mailto:${event.support_email}`}>
                  <Mail className="h-3.5 w-3.5" /> Contact the organizers
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
