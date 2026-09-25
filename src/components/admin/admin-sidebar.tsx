"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/site/app-header";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Settings2,
  Users,
  Trophy,
  FolderGit2,
  Gavel,
  Bell,
  FileText,
  Newspaper,
  Inbox,
  ShieldCheck,
  ScrollText,
  IdCard,
  LogOut,
  Sparkles,
  MessageSquareHeart,
  KeyRound,
  History,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

type NavLink = { href: string; label: string; icon: LucideIcon };

const SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Overview",
    links: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Participants",
    links: [
      { href: "/admin/registrations", label: "Registrations", icon: Users },
      { href: "/admin/requests", label: "Requests", icon: Inbox },
      { href: "/admin/id-cards", label: "ID Cards", icon: IdCard },
      { href: "/admin/feedback", label: "Feedback", icon: MessageSquareHeart },
    ],
  },
  {
    title: "Competition",
    links: [
      { href: "/admin/rounds", label: "Rounds", icon: Trophy },
      { href: "/admin/schedule", label: "Schedule", icon: CalendarClock },
      { href: "/admin/submissions", label: "Submissions", icon: FolderGit2 },
      { href: "/admin/judging", label: "Judging & Scores", icon: Gavel },
    ],
  },
  {
    title: "Communication",
    links: [
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/content", label: "Content & Policies", icon: Newspaper },
      { href: "/admin/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    title: "Settings",
    links: [
      { href: "/admin/events", label: "Event & Branding", icon: Settings2 },
      { href: "/admin/roles", label: "Roles & Admins", icon: ShieldCheck },
      { href: "/admin/login-activity", label: "Login Activity", icon: History },
      { href: "/admin/audit-logs", label: "Audit Log", icon: ScrollText },
      { href: "/admin/account", label: "Account", icon: KeyRound },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

function useSignOut(onDone?: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    onDone?.();
    router.replace("/");
    router.refresh();
  }
  return { busy, signOut };
}

function SidebarBody({ role, eventName, onNavigate }: { role: string; eventName: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { busy, signOut } = useSignOut(onNavigate);

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-2 px-3 pr-10 pt-1 font-heading text-lg font-semibold text-burgundy lg:pr-3"
      >
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        <span className="truncate">{eventName}</span>
      </Link>
      <div className="mt-1 flex items-center gap-2 px-3">
        <span className="text-xs text-burgundy/55">Admin panel</span>
        <Badge variant="outline" className="capitalize">{role.replace("_", " ")}</Badge>
      </div>

      <nav aria-label="Admin" className="-mx-1 mt-4 flex-1 overflow-y-auto px-1">
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
                        "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                        active ? "bg-primary text-primary-foreground shadow-sm" : "text-burgundy/70 hover:bg-primary/8 hover:text-burgundy",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sign-out at every viewport width (BUG-021). */}
      <div className="border-t border-primary/12 pt-3">
        <Button
          variant="ghost"
          className="min-h-10 w-full justify-start gap-3 px-3 font-medium text-burgundy/70 hover:text-burgundy"
          disabled={busy}
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" aria-hidden /> {busy ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}

export function AdminSidebar({ role, eventName }: { role: string; eventName: string }) {
  return (
    <AppHeader eventName={eventName} homeHref="/admin" menuTitle="Admin menu">
      {(close) => <SidebarBody role={role} eventName={eventName} onNavigate={close} />}
    </AppHeader>
  );
}
