import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { PageHeader } from "@/components/site/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Phone, Globe, ShieldAlert } from "lucide-react";
import { telHref } from "@/lib/utils";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Contact Skillglider",
  description: "Get in touch with Skillglider for questions about Zing Hackathon registration, the participant portal, or submissions.",
  path: "/contact",
});

export default async function ContactPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  return (
    <main>
      <PageHeader
        eyebrow="We're here to help"
        title={`Need help with ${event.name}?`}
        description={`Contact ${event.organizer_name} for registration, portal access, submission, or event-related queries.`}
      />
      <div className="mx-auto max-w-xl space-y-6 px-4 py-16 sm:px-6">
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" className="glow-primary" asChild>
            <a href={`mailto:${event.support_email}`}>
              <Mail className="h-4 w-4" /> Email support
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={telHref(event.support_phone)}>
              <Phone className="h-4 w-4" /> Call support
            </a>
          </Button>
          {event.support_website && (
            <Button size="lg" variant="outline" asChild>
              <a href={event.support_website} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4" /> Visit {event.organizer_name}
              </a>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-4">
              <Mail className="h-5 w-5 shrink-0 text-primary" />
              <a href={`mailto:${event.support_email}`} className="font-medium hover:underline">
                {event.support_email}
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Phone className="h-5 w-5 shrink-0 text-primary" />
              <a href={telHref(event.support_phone)} className="font-medium hover:underline">
                {event.support_phone}
              </a>
            </div>
            {event.support_website && (
              <div className="flex items-center gap-4">
                <Globe className="h-5 w-5 shrink-0 text-primary" />
                <a href={event.support_website} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                  {event.support_website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Include your team reference and a short description of the issue. Never share your password,
            verification code, or private credentials.
          </AlertDescription>
        </Alert>
      </div>
    </main>
  );
}
