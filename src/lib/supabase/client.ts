import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// For pages that consume an emailed auth link (/auth/set-password): a
// dedicated, non-singleton client that does NOT auto-detect sessions in the
// URL, so the page itself decides which credentials are used and never falls
// back to an unrelated session already stored in the browser (BUG-015).
export function createLinkClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false, auth: { detectSessionInUrl: false } },
  );
}
