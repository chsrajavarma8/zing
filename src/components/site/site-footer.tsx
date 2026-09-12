import Link from "next/link";
import { Zap, Mail, Phone, Globe } from "lucide-react";
import { telHref } from "@/lib/utils";

export function SiteFooter({
  eventName = "Zing Hackathon",
  organizerName = "Skillglider",
  supportEmail = "skillglider4@gmail.com",
  supportPhone = "+91 7993446574",
  supportWebsite = "https://skillglider.in",
}: {
  eventName?: string;
  organizerName?: string;
  supportEmail?: string;
  supportPhone?: string;
  supportWebsite?: string | null;
}) {
  return (
    <footer className="border-t border-border/70 bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" fill="currentColor" />
            </span>
            <span>{eventName}</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Organized by{" "}
            {supportWebsite ? (
              <a href={supportWebsite} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                {organizerName}
              </a>
            ) : (
              organizerName
            )}
          </p>
        </div>

        <FooterCol
          title="Event"
          links={[
            { href: "/about", label: "About" },
            { href: "/rounds", label: "Rounds" },
            { href: "/schedule", label: "Schedule" },
            { href: "/prizes", label: "Prizes & Judging" },
            { href: "/scoreboard", label: "Scoreboard" },
            { href: "/announcements", label: "Announcements" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { href: "/rules", label: "Rules & Regulations" },
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/terms", label: "Terms & Conditions" },
            { href: "/faq", label: "FAQ" },
          ]}
        />
        <div>
          <p className="text-sm font-semibold">Contact</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <a href={`mailto:${supportEmail}`} className="hover:text-foreground hover:underline">
                {supportEmail}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <a href={telHref(supportPhone)} className="hover:text-foreground hover:underline">
                {supportPhone}
              </a>
            </li>
            {supportWebsite && (
              <li className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <a href={supportWebsite} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                  {supportWebsite.replace(/^https?:\/\//, "")}
                </a>
              </li>
            )}
            <li>
              <Link href="/contact" className="underline underline-offset-4 hover:text-foreground">
                Contact page
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {organizerName}. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
