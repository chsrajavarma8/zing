"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/site/app-header";
import {
  LayoutDashboard,
  UserRound,
  Users,
  CalendarClock,
  FolderGit2,
  Trophy,
  Inbox,
  Bell,
  IdCard,
  FileText,
  MessageSquareHeart,
  LogOut,
  Sparkles,
  LifeBuoy,
  Crown,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NavLink = { href: string; label: string; icon: LucideIcon };

// Every portal section lives in the sidebar - on desktop it's always visible,
// on phones and tablets the same sidebar slides in from the menu button.
const SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Event",
    links: [
      { href: "/portal", label: "Overview", icon: LayoutDashboard },
      { href: "/portal/schedule", label: "Schedule", icon: CalendarClock },
      { href: "/portal/submission", label: "Submission", icon: FolderGit2 },
      { href: "/portal/results", label: "My Results", icon: Trophy },
    ],
  },
  {
    title: "You & your team",
    links: [
      { href: "/portal/team", label: "Team", icon: Users },
      { href: "/portal/profile", label: "Profile", icon: UserRound },
      { href: "/portal/id-card", label: "ID Card", icon: IdCard },
    ],
  },
  {
    title: "Updates & help",
    links: [
      { href: "/portal/notifications", label: "Notifications", icon: Bell },
      { href: "/portal/documents", label: "Documents", icon: FileText },
      { href: "/portal/requests", label: "Requests", icon: Inbox },
      { href: "/portal/feedback", label: "Feedback", icon: MessageSquareHeart },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/portal" && pathname.startsWith(`${href}/`));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function UnreadBadge({ count, inverted }: { count: number; inverted?: boolean }) {
  if (count <= 0) return null;
  return (
    <Badge className="h-5 min-w-5 justify-center px-1.5" variant={inverted ? "secondary" : "default"}>
      {count > 9 ? "9+" : count}
    </Badge>
  );
}

export interface PortalSidebarProps {
  eventName: string;
  unreadCount?: number;
  role: "lead" | "member";
  memberName: string;
  teamName: string;
  teamReference: string;
}

function SidebarBody({
  eventName,
  unreadCount = 0,
  role,
  memberName,
  teamName,
  teamReference,
  onNavigate,
}: PortalSidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/portal"
        onClick={onNavigate}
        className="flex items-center gap-2 px-3 pr-10 pt-1 font-heading lg:pr-3 text-lg font-semibold text-burgundy"
      >
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        <span className="truncate">{eventName}</span>
      </Link>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/12 bg-background/60 p-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground"
        >
          {initials(memberName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-burgundy">{memberName}</p>
          <p className="truncate text-xs text-burgundy/60" title={`${teamName} · ${teamReference}`}>
            {teamName}
          </p>
          <Badge variant={role === "lead" ? "default" : "outline"} className="mt-1 gap-1 px-1.5 py-0 text-[10px] font-normal">
            {role === "lead" && <Crown className="h-3 w-3" />}
            {role === "lead" ? "Team Lead" : "Member"}
          </Badge>
        </div>
      </div>

      <nav aria-label="Portal" className="-mx-1 mt-4 flex-1 overflow-y-auto px-1">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-burgundy/45">{section.title}</p>
            <ul className="flex flex-col gap-0.5">
              {section.links.map((link) => {
                const Icon = link.icon;
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-burgundy/70 hover:bg-primary/8 hover:text-burgundy",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {link.label}
                      </span>
                      {link.href === "/portal/notifications" && <UnreadBadge count={unreadCount} inverted={active} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-primary/12 pt-3">
        <Link
          href="/contact"
          onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-burgundy/70 transition-colors hover:bg-primary/8 hover:text-burgundy"
        >
          <LifeBuoy className="h-4 w-4" aria-hidden /> Need help? Contact us
        </Link>
        <Button
          variant="ghost"
          className="min-h-10 w-full justify-start gap-3 px-3 font-medium text-burgundy/70 hover:text-burgundy"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            onNavigate?.();
            router.replace("/");
            router.refresh();
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </Button>
      </div>
    </div>
  );
}

export function PortalSidebar(props: PortalSidebarProps) {
  return (
    <AppHeader eventName={props.eventName} homeHref="/portal" menuTitle="Portal menu" showDot={(props.unreadCount ?? 0) > 0}>
      {(close) => <SidebarBody {...props} onNavigate={close} />}
    </AppHeader>
  );
}
