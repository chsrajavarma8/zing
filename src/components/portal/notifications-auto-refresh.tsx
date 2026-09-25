"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// BUG-022: scheduled notifications become readable at their scheduled time
// (released by the database), but a portal page that was already open would
// only show them after the next navigation. While the tab is visible, this
// checks the unread count once a minute - one lightweight HEAD count query,
// filtered by RLS to released notifications - and refreshes the server-rendered
// page only when the count changes. It also checks as soon as the tab becomes
// visible again.
const INTERVAL_MS = 60_000;

export function NotificationsAutoRefresh({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const router = useRouter();
  const last = useRef(initialUnread);

  useEffect(() => {
    last.current = initialUnread;
  }, [initialUnread]);

  useEffect(() => {
    const supabase = createClient();
    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      const { count, error } = await supabase
        .from("notification_recipients")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userId)
        .eq("channel", "in_app")
        .is("read_at", null);
      if (error || count === null || stopped) return;
      if (count !== last.current) {
        last.current = count;
        router.refresh();
      }
    }

    const timer = setInterval(check, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, userId]);

  return null;
}
