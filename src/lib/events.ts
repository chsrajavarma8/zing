import { createClient } from "@/lib/supabase/server";
import type { Event } from "@/types/database";

// Single-tenant convenience helper: the public site always shows the event
// flagged is_default. Multi-event support (picking by slug) is available via
// getEventBySlug for admin tooling; the public site can be pointed at a
// different slug later without changing this file's shape.
export async function getPublicEvent(): Promise<Event | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("is_default", true)
    .maybeSingle();
  return (data as unknown as Event) ?? null;
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("slug", slug).maybeSingle();
  return (data as unknown as Event) ?? null;
}
