"use client";

import { motion, useReducedMotion } from "framer-motion";

// Original abstract technology visual: a layered node network suggesting
// "connected ideas" resolving into a built structure, rendered as inline SVG
// (no external assets, no WebGL) so it stays lightweight and themeable.
// Pulsing nodes are transform/opacity only and skip entirely under
// prefers-reduced-motion.
const NODES = [
  { x: 210, y: 60, r: 5 },
  { x: 340, y: 40, r: 4 },
  { x: 90, y: 120, r: 4 },
  { x: 300, y: 150, r: 6 },
  { x: 150, y: 200, r: 4 },
  { x: 380, y: 220, r: 5 },
  { x: 60, y: 260, r: 4 },
  { x: 230, y: 300, r: 5 },
];

const LINKS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [2, 4],
  [3, 5],
  [3, 6],
  [4, 6],
  [4, 7],
  [5, 7],
];

export function HeroVisual() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden>
      {/* Atmospheric glow layers */}
      <div
        className="motion-safe:animate-pulse absolute -top-10 left-1/4 h-64 w-64 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)", animationDuration: "6s" }}
      />
      <div
        className="motion-safe:animate-pulse absolute bottom-0 right-0 h-56 w-56 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand-to), transparent 70%)", animationDuration: "8s", animationDelay: "1s" }}
      />

      {/* Rotated build-platform frame */}
      <div
        className="motion-safe:animate-spin absolute inset-8 rounded-[2rem] border border-primary/25"
        style={{ animationDuration: "40s" }}
      />
      <div className="absolute inset-16 rounded-[1.5rem] border border-primary/15" />

      <svg viewBox="0 0 440 360" className="relative h-full w-full" role="img" aria-label="Abstract network of connected nodes representing collaborative building">
        <defs>
          <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-from)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--brand-to)" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="hero-node">
            <stop offset="0%" stopColor="var(--foreground)" />
            <stop offset="100%" stopColor="var(--brand-via)" />
          </radialGradient>
        </defs>

        {LINKS.map(([a, b], i) => {
          const from = NODES[a];
          const to = NODES[b];
          return (
            <motion.line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="url(#hero-line)"
              strokeWidth={1.5}
              initial={reduceMotion ? { opacity: 0.6 } : { pathLength: 0, opacity: 0 }}
              whileInView={reduceMotion ? { opacity: 0.6 } : { pathLength: 1, opacity: 0.6 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: i * 0.08, ease: "easeOut" }}
            />
          );
        })}

        {NODES.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill="url(#hero-node)"
            initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 + i * 0.06 }}
            style={{ filter: "drop-shadow(0 0 6px var(--primary))" }}
          />
        ))}
      </svg>
    </div>
  );
}
