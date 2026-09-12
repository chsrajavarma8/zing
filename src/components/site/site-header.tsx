"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { registrationCtaLabel, type RegistrationStatus } from "@/lib/registration-status";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/rounds", label: "Rounds" },
  { href: "/schedule", label: "Schedule" },
  { href: "/prizes", label: "Prizes" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/faq", label: "FAQ" },
];

function RegisterButton({ status, onClick, className }: { status: RegistrationStatus | null; onClick?: () => void; className?: string }) {
  if (!status || status.isOpen) {
    return (
      <Button asChild className={cn("glow-primary", className)} onClick={onClick}>
        <Link href="/register">Register your team</Link>
      </Button>
    );
  }
  return (
    <Button disabled variant="secondary" className={className} title={registrationCtaLabel(status)}>
      {registrationCtaLabel(status)}
    </Button>
  );
}

// Fires only on the boolean edge (scrolled / not-scrolled), not on every
// scroll pixel - avoids a state update per frame.
function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

export function SiteHeader({
  eventName = "Zing Hackathon",
  logoUrl,
  registrationStatus = null,
}: {
  eventName?: string;
  logoUrl?: string;
  registrationStatus?: RegistrationStatus | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled();

  return (
    // Outer wrapper height never changes on scroll - only the inner bar's
    // inset/shadow/radius do, via a plain CSS transition - so the page
    // content below never shifts.
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
      {/*
        Only background-color/border-color/box-shadow animate here - never
        width/padding/max-width, which would force layout reflow every
        scroll-driven frame instead of a cheap compositor-only repaint.
        Always has a visible surface (never fully transparent), so it never
        reads as "missing" before the user scrolls.
      */}
      <div
        className={cn(
          "mx-auto flex h-16 max-w-5xl items-center justify-between rounded-2xl border px-4 backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300 ease-out sm:px-5",
          scrolled
            ? "border-primary/15 bg-ivory/90 shadow-[0_8px_30px_-12px_rgba(128,0,32,0.25)]"
            : "border-primary/10 bg-ivory/55 shadow-none",
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-heading text-lg font-semibold tracking-tight">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" fill="currentColor" />
            </span>
          )}
          <span>{eventName}</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">by Skillglider</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                {link.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <RegisterButton status={registrationStatus} />
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-ivory">
              <SheetTitle className="px-4 pt-4 font-heading">Menu</SheetTitle>
              <nav className="mt-4 flex flex-col gap-1 px-4" aria-label="Mobile">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      pathname === link.href && "bg-accent text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  <Button variant="outline" asChild onClick={() => setOpen(false)}>
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <RegisterButton status={registrationStatus} onClick={() => setOpen(false)} />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
