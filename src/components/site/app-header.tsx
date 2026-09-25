"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Menu, Sparkles } from "lucide-react";

// Shared top bar for the admin panel and the participant portal:
// [ Event name ............ Menu ]. Menu slides in the section's full sidebar.
export function AppHeader({
  eventName,
  homeHref,
  menuTitle,
  showDot = false,
  children,
}: {
  eventName: string;
  homeHref: string;
  menuTitle: string;
  // Small indicator on the Menu button (e.g. unread notifications).
  showDot?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-primary/12 bg-cream/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link href={homeHref} className="flex min-w-0 items-center gap-2 font-heading text-lg font-semibold text-burgundy">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">{eventName}</span>
          </Link>
          <Button
            variant="outline"
            className="relative h-10 shrink-0 gap-2 border-primary/20 px-3 text-burgundy"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={showDot ? `${menuTitle}, you have unread notifications` : menuTitle}
          >
            <Menu className="h-5 w-5" />
            <span className="text-sm font-medium">Menu</span>
            {showDot && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-cream" aria-hidden />}
          </Button>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[85vw] max-w-xs bg-cream p-4"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <SheetTitle className="sr-only">{menuTitle}</SheetTitle>
          <SheetDescription className="sr-only">All sections of the {menuTitle.toLowerCase()}.</SheetDescription>
          {children(() => setOpen(false))}
        </SheetContent>
      </Sheet>
    </>
  );
}
