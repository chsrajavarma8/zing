"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
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
  Menu,
  LogOut,
  Sparkles,
  LifeBuoy,
  Crown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const LINKS = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard },
  { href: "/portal/profile", label: "Profile", icon: UserRound },
  { href: "/portal/team", label: "Team", icon: Users },
  { href: "/portal/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/portal/submission", label: "Submission", icon: FolderGit2 },
  { href: "/portal/results", label: "My Results", icon: Trophy },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
  { href: "/portal/id-card", label: "ID Card", icon: IdCard },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/requests", label: "Requests", icon: Inbox },
  { href: "/portal/feedback", label: "Feedback", icon: MessageSquareHeart },
];

function NavLinks({ onNavigate, unreadCount = 0 }: { onNavigate?: () => void; unreadCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-burgundy/65 transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-primary/8 hover:text-burgundy",
            )}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" />
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
    </nav>
  );
}

function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-3 text-burgundy/65 hover:text-burgundy"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" /> Sign out
    </Button>
  );
}

function RoleBadge({ role }: { role: "lead" | "member" }) {
  return (
    <Badge variant={role === "lead" ? "default" : "outline"} className="gap-1 font-normal">
      {role === "lead" && <Crown className="h-3 w-3" />}
      {role === "lead" ? "Team Lead" : "Member"}
    </Badge>
  );
}

export function PortalSidebar({
  eventName,
  unreadCount = 0,
  role,
}: {
  eventName: string;
  unreadCount?: number;
  role: "lead" | "member";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-primary/12 bg-cream p-4 lg:flex">
        <Link href="/portal" className="mb-3 flex items-center gap-2 px-2 font-heading font-semibold text-burgundy">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="truncate">{eventName}</span>
        </Link>
        <div className="mb-3 px-2">
          <RoleBadge role={role} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks unreadCount={unreadCount} />
        </div>
        <div className="space-y-1 border-t border-primary/12 pt-3">
          <Link
            href="/contact"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-burgundy/65 transition-colors hover:bg-primary/8 hover:text-burgundy"
          >
            <LifeBuoy className="h-4 w-4" /> Need help? Contact
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-primary/12 bg-cream/95 p-3 backdrop-blur lg:hidden">
        <Link href="/portal" className="flex items-center gap-2 font-heading font-semibold text-burgundy">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="truncate">{eventName}</span>
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="relative">
              <Menu className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-cream">
            <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
            <div className="px-4">
              <RoleBadge role={role} />
            </div>
            <div className="mt-4 px-4">
              <NavLinks onNavigate={() => setOpen(false)} unreadCount={unreadCount} />
              <div className="mt-4 space-y-1 border-t border-primary/12 pt-3">
                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-burgundy/65 hover:bg-primary/8 hover:text-burgundy"
                >
                  <LifeBuoy className="h-4 w-4" /> Need help? Contact
                </Link>
                <SignOutButton />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
