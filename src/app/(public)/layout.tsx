import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SkipLink } from "@/components/site/skip-link";
import { getPublicEvent } from "@/lib/events";
import { getRegistrationStatus } from "@/lib/registration-status";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const event = await getPublicEvent();

  const logoUrl = (event?.branding as { logo_url?: string } | null)?.logo_url;
  const registrationStatus = event ? getRegistrationStatus(event) : null;

  return (
    <>
      <SkipLink />
      <SiteHeader eventName={event?.name} logoUrl={logoUrl} registrationStatus={registrationStatus} />
      <div id="main-content" className="flex-1">{children}</div>
      <SiteFooter
        eventName={event?.name}
        organizerName={event?.organizer_name}
        supportEmail={event?.support_email}
        supportPhone={event?.support_phone}
        supportWebsite={event?.support_website}
      />
    </>
  );
}
