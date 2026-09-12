"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Waves, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackgroundMotionPreference } from "@/lib/use-background-motion-preference";

type Intensity = "full" | "soft" | "minimal" | "static";

function intensityFor(pathname: string): Intensity {
  if (pathname.startsWith("/portal/exam")) return "static";
  if (pathname.startsWith("/portal") || pathname.startsWith("/admin")) return "minimal";
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/auth/")
  ) {
    return "soft";
  }
  return "full";
}

// Deterministic (not Math.random()) so server and client render identically
// on first paint - avoids a hydration mismatch. x/y are viewport
// percentages, delay/duration in seconds.
const PARTICLES = [
  { x: 8, y: 18, size: 6, delay: 0, duration: 22, color: "var(--burgundy)" },
  { x: 22, y: 62, size: 4, delay: 3, duration: 26, color: "var(--rose)" },
  { x: 38, y: 12, size: 5, delay: 6, duration: 24, color: "var(--rose)" },
  { x: 55, y: 75, size: 4, delay: 2, duration: 28, color: "var(--burgundy)" },
  { x: 68, y: 30, size: 6, delay: 8, duration: 25, color: "var(--rose)" },
  { x: 82, y: 55, size: 4, delay: 4, duration: 27, color: "var(--burgundy)" },
  { x: 91, y: 15, size: 5, delay: 10, duration: 23, color: "var(--rose)" },
  { x: 15, y: 88, size: 4, delay: 5, duration: 29, color: "var(--burgundy)" },
];

// One reusable, root-mounted decorative background: ivory base (from body),
// slow drifting cream/rose gradients, sparse low-opacity particles, and a
// faint grid for depth. Fully inert to interaction (pointer-events: none,
// aria-hidden) and never intercepts clicks, selection, or scrolling.
export function SiteBackground() {
  const pathname = usePathname();
  const intensity = intensityFor(pathname);
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useBackgroundMotionPreference();
  const layerRef = useRef<HTMLDivElement>(null);
  const isPublicHome = pathname === "/";

  const motionOff = reduceMotion || paused || intensity === "static";

  // Scroll parallax on the decorative layer only, via direct style writes
  // (no React state per frame) - rAF-throttled, skipped entirely when
  // motion is off, and paused while the tab is hidden.
  useEffect(() => {
    if (motionOff) return;
    if (typeof window === "undefined") return;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return; // touch devices: no parallax

    let raf = 0;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY * 0.04, 60);
        if (layerRef.current) {
          layerRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
        }
        ticking = false;
      });
    }

    function onVisibility() {
      if (document.hidden && raf) cancelAnimationFrame(raf);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [motionOff]);

  const showParticles = useMemo(() => intensity === "full" || intensity === "soft", [intensity]);
  const blobOpacity = { full: 1, soft: 0.65, minimal: 0.3, static: 0.2 }[intensity];
  const showGrid = intensity !== "minimal" && intensity !== "static";

  return (
    <>
      <div
        aria-hidden="true"
        className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", motionOff && "bg-motion-paused")}
      >
      <div ref={layerRef} className="absolute inset-0">
        {/* Large soft drifting gradients */}
        <div
          className="bg-blob-a absolute -top-1/4 -left-1/4 h-[60vw] w-[60vw] max-h-[42rem] max-w-[42rem] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, color-mix(in oklab, var(--cream) 85%, var(--rose) 15%), transparent 70%)",
            opacity: blobOpacity * (isPublicHome ? 0.9 : 0.6),
          }}
        />
        <div
          className="bg-blob-b absolute top-1/3 -right-1/4 h-[55vw] w-[55vw] max-h-[38rem] max-w-[38rem] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, color-mix(in oklab, var(--rose) 22%, var(--cream) 78%), transparent 72%)",
            opacity: blobOpacity * (isPublicHome ? 0.7 : 0.45),
          }}
        />
        {intensity === "full" && (
          <div
            className="bg-blob-c absolute bottom-[-20%] left-1/3 h-[50vw] w-[50vw] max-h-[34rem] max-w-[34rem] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, color-mix(in oklab, var(--burgundy) 10%, var(--cream) 90%), transparent 70%)",
              opacity: blobOpacity * (isPublicHome ? 0.6 : 0.35),
            }}
          />
        )}

        {/* Faint grid for depth */}
        {showGrid && <div className="bg-grid absolute inset-0" style={{ opacity: intensity === "full" ? 0.4 : 0.2 }} />}

        {/* Sparse particles */}
        {showParticles &&
          PARTICLES.map((p, i) => (
            <span
              key={i}
              className="bg-particle absolute rounded-full"
              style={
                {
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  "--particle-opacity": intensity === "full" ? 0.3 : 0.18,
                  "--float-x": `${(i % 2 === 0 ? 1 : -1) * (8 + p.size)}px`,
                  "--float-y": `${(i % 3 === 0 ? 1 : -1) * (14 + p.size)}px`,
                } as React.CSSProperties
              }
            />
          ))}
      </div>
      </div>

      {/* Discreet, accessible motion control - a preference, not a theme
          toggle. Rendered as a sibling of the aria-hidden decorative layer
          (not a child of it), so it stays reachable by keyboard and screen
          readers regardless of the background's own hidden state. */}
      <div className="fixed bottom-4 left-4 z-10">
        <Button
          variant="secondary"
          size="icon-sm"
          className="opacity-50 shadow-sm hover:opacity-100"
          aria-pressed={paused}
          aria-label={paused ? "Resume background animation" : "Pause background animation"}
          title={paused ? "Resume background animation" : "Pause background animation"}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Waves className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </>
  );
}
