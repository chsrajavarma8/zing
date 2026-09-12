"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
  once?: boolean;
  id?: string;
}

// Shared scroll-triggered entrance used across the public site. Respects
// prefers-reduced-motion by disabling the transform/opacity animation
// entirely (content renders in its final state immediately) rather than
// just shortening it - per the "avoid distracting motion" requirement.
export function Reveal({ children, delay = 0, className, y = 18, once = true, id }: RevealProps) {
  const reduceMotion = useReducedMotion();

  const variants: Variants = reduceMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y }, visible: { opacity: 1, y: 0 } };

  return (
    <motion.div
      id={id}
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px" }}
      variants={variants}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Wrap a list of children to stagger their Reveal delay automatically.
export function StaggerReveal({
  children,
  className,
  step = 0.08,
}: {
  children: ReactNode[];
  className?: string;
  step?: number;
}) {
  return (
    <>
      {children.map((child, i) => (
        <Reveal key={i} delay={i * step} className={className}>
          {child}
        </Reveal>
      ))}
    </>
  );
}
