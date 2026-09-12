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
  FileQuestion,
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const LINKS = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard },
  { href: "/portal/profile", label: "Profile", icon: UserRound },
  { href: "/portal/team", label: "Team", icon: Users },
  { href: "/portal/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/portal/exam", label: "Screening Exam", icon: FileQuestion },
  { href: "/portal/submission", label: "Submission", icon: FolderGit2 },
  { href: "/portal/results", label: "My Results", icon: Trophy },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
  { href: "/portal/id-card", label: "ID Card", icon: IdCard },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/requests", label: "Requests", icon: Inbox },
  { href: "/portal/feedback", label: "Feedback", icon: MessageSquareHeart },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
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
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-burgundy/65 transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-primary/8 hover:text-burgundy",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {link.label}
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

export function PortalSidebar({ eventName }: { eventName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-primary/12 bg-cream p-4 lg:flex">
        <Link href="/portal" className="mb-6 flex items-center gap-2 px-2 font-heading font-semibold text-burgundy">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="truncate">{eventName}</span>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
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
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-cream">
            <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
            <div className="mt-4 px-4">
              <NavLinks onNavigate={() => setOpen(false)} />
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
