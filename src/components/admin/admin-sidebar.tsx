"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
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
  Menu,
  LogOut,
  Sparkles,
  MessageSquareHeart,
  KeyRound,
  History,
} from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Event & Branding", icon: Settings2 },
  { href: "/admin/registrations", label: "Registrations", icon: Users },
  { href: "/admin/rounds", label: "Rounds", icon: Trophy },
  { href: "/admin/submissions", label: "Submissions", icon: FolderGit2 },
  { href: "/admin/judging", label: "Judging & Scores", icon: Gavel },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/content", label: "Content & Policies", icon: Newspaper },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/requests", label: "Requests", icon: Inbox },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareHeart },
  { href: "/admin/id-cards", label: "ID Cards", icon: IdCard },
  { href: "/admin/roles", label: "Roles & Admins", icon: ShieldCheck },
  { href: "/admin/login-activity", label: "Login Activity", icon: History },
  { href: "/admin/audit-logs", label: "Audit Log", icon: ScrollText },
  { href: "/admin/account", label: "Account", icon: KeyRound },
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
              active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-primary/8 hover:text-burgundy",
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

export function AdminSidebar({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-primary/12 bg-cream p-4 lg:flex">
        <div className="mb-2 flex items-center gap-2 px-2 font-heading font-semibold text-burgundy">
          <Sparkles className="h-5 w-5 text-primary" />
          Admin
        </div>
        <Badge variant="outline" className="mb-4 w-fit capitalize">{role.replace("_", " ")}</Badge>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-primary/12 pt-3">
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
        </div>
      </aside>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-primary/12 bg-cream/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 font-heading font-semibold text-burgundy">
          <Sparkles className="h-5 w-5 text-primary" /> Admin
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-cream">
            <SheetTitle className="px-4 pt-4">Admin menu</SheetTitle>
            <div className="mt-4 px-4">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
