import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-boundary enforcement of the mandatory password-change gate. The
// portal layout redirect (src/app/portal/layout.tsx) only stops page
// navigation - a direct call to a server action or API route bypasses it
// entirely, since those don't re-render the layout. Every participant
// mutation that matters must check this explicitly and FAIL CLOSED: if the
// profile row can't be read for any reason, treat the caller as still
// restricted rather than assuming they're clear.
export async function requirePasswordChanged(
  supabase: SupabaseClient,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.from("profiles").select("must_change_password").eq("id", user.id).maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Could not verify account status. Please sign in again." };
  }
  if ((data as { must_change_password: boolean }).must_change_password) {
    return { ok: false, error: "Set your private password before continuing — see /change-password." };
  }

  return { ok: true, userId: user.id };
}
