"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Users,
  FolderGit2,
  CalendarClock,
  MoreHorizontal,
  Trophy,
  Bell,
  UserRound,
  IdCard,
  FileText,
  Inbox,
  MessageSquareHeart,
  LifeBuoy,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Req.: mobile bottom navigation with exactly these five destinations - the
// remaining portal sections live behind "More" so labels stay identical
// across desktop (sidebar) and mobile (bottom bar).
const TABS = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/team", label: "Team", icon: Users },
  { href: "/portal/submission", label: "Submissions", icon: FolderGit2 },
  { href: "/portal/schedule", label: "Schedule", icon: CalendarClock },
] as const;

const MORE_LINKS = [
  { href: "/portal/results", label: "My Results", icon: Trophy },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
  { href: "/portal/profile", label: "Profile", icon: UserRound },
  { href: "/portal/id-card", label: "ID Card", icon: IdCard },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/requests", label: "Requests", icon: Inbox },
  { href: "/portal/feedback", label: "Feedback", icon: MessageSquareHeart },
  { href: "/contact", label: "Support", icon: LifeBuoy },
] as const;

export function PortalBottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_LINKS.some((l) => l.href === pathname);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-primary/12 bg-cream/97 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-burgundy/60 hover:text-burgundy",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
            isMoreActive ? "text-primary" : "text-burgundy/60 hover:text-burgundy",
          )}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          More
          {unreadCount > 0 && (
            <span className="absolute right-4 top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
          )}
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-cream pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <SheetTitle className="px-4 pt-4">More</SheetTitle>
          <div className="flex flex-col gap-0.5 px-4">
            {MORE_LINKS.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-burgundy/70 hover:bg-primary/8 hover:text-burgundy",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" aria-hidden />
                    {link.label}
                  </span>
                  {link.href === "/portal/notifications" && unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 justify-center px-1.5" variant={active ? "secondary" : "default"}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                setMoreOpen(false);
                router.replace("/");
                router.refresh();
              }}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-burgundy/70 transition-colors hover:bg-primary/8 hover:text-burgundy"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
