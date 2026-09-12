"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "zing-bg-motion-paused";

// Purely a decorative-background motion preference - unrelated to
// dark/light mode (there is only one theme) and independent of the OS
// prefers-reduced-motion setting, though both end up disabling the same
// CSS animations (see .bg-motion-paused in globals.css).
export function useBackgroundMotionPreference(): [boolean, (paused: boolean) => void] {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    try {
      setPaused(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Private browsing / blocked storage - default to playing, no crash.
    }
  }, []);

  const update = (value: boolean) => {
    setPaused(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Non-fatal - the in-memory state still applies for this session.
    }
  };

  return [paused, update];
}
