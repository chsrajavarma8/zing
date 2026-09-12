"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultLandingPath, getUserContext } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { recordLoginActivity, resolveLoginActivityRole } from "@/lib/auth/login-activity";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const GENERIC_ERROR = "Unable to sign in. Check your email and password and try again.";

export async function signIn(email: string, password: string): Promise<ActionResult & { redirectTo?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !password) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Two rate limits, both fairly tight: participant accounts can start out
  // on a server-generated temporary password with a smaller guess space
  // than a freely-chosen one, so brute force resistance here matters more
  // than it would for a normal password login.
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = hdrs.get("user-agent");
  const emailLimited = rateLimit(`login:email:${trimmed}`, 6, 15 * 60 * 1000);
  const ipLimited = rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
  if (!emailLimited.ok || !ipLimited.ok) {
    await recordLoginActivity({ attemptedEmail: trimmed, outcome: "rate_limited", ipAddress: ip, userAgent });
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });

  if (error) {
    await recordLoginActivity({ attemptedEmail: trimmed, outcome: "invalid_credentials", ipAddress: ip, userAgent });
    return { ok: false, error: GENERIC_ERROR };
  }

  // Successful authentication with this account's own real password is the
  // proof of ownership required to link any team_members rows that were
  // registered under this email but pointed at a pre-existing account (see
  // provisionParticipantAccount) - never done on attacker-submitted
  // registration data alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    const admin = createAdminClient();
    await admin.from("team_members").update({ profile_id: user.id }).eq("email", trimmed).is("profile_id", null);
  }

  const ctx = await getUserContext();
  await recordLoginActivity({
    attemptedEmail: trimmed,
    profileId: user?.id ?? null,
    role: resolveLoginActivityRole(ctx),
    outcome: "success",
    ipAddress: ip,
    userAgent,
  });
  return { ok: true, redirectTo: defaultLandingPath(ctx) };
}
