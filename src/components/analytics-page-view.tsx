"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

// No-op unless NEXT_PUBLIC_ANALYTICS_ENABLED=true and a provider is wired
// in src/lib/analytics.ts - see that file's header comment.
export function AnalyticsPageView() {
  const pathname = usePathname();

  useEffect(() => {
    track({ name: "page_view", props: { path: pathname } });
  }, [pathname]);

  return null;
}
