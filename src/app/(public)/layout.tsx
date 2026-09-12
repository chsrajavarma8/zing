import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SkipLink } from "@/components/site/skip-link";
import { getPublicEvent } from "@/lib/events";
import { getRegistrationStatus } from "@/lib/registration-status";
import { getUserContext, isStaff } from "@/lib/auth/session";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [event, userCtx] = await Promise.all([getPublicEvent(), getUserContext()]);

  const logoUrl = (event?.branding as { logo_url?: string } | null)?.logo_url;
  const registrationStatus = event ? getRegistrationStatus(event) : null;
  const dashboardHref = isStaff(userCtx) ? "/admin" : "/portal";

  return (
    <>
      <SkipLink />
      <SiteHeader
        eventName={event?.name}
        logoUrl={logoUrl}
        registrationStatus={registrationStatus}
        isSignedIn={Boolean(userCtx)}
        dashboardHref={dashboardHref}
      />
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
