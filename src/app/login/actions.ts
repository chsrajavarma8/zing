"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { defaultLandingPath, getUserContext, isStaff } from "@/lib/auth/session";
import { clientIp, sharedRateLimit } from "@/lib/rate-limit";
import { recordLoginActivity, resolveLoginActivityRole } from "@/lib/auth/login-activity";
import { linkConfirmedParticipantRows } from "@/lib/auth/participant-provisioning";
import { safeNextPath } from "@/lib/safe-redirect";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const GENERIC_ERROR = "Unable to sign in. Check your email and password and try again.";

export async function signIn(email: string, password: string, next?: string | null): Promise<ActionResult & { redirectTo?: string }> {
  const trimmed = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!trimmed || typeof password !== "string" || !password) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Shared (cross-instance) limits per email and per IP (RISK-002).
  const hdrs = await headers();
  const ip = clientIp(hdrs);
  const userAgent = hdrs.get("user-agent");
  const [emailLimited, ipLimited] = await Promise.all([
    sharedRateLimit(`login:email:${trimmed}`, 6, 15 * 60 * 1000),
    sharedRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000),
  ]);
  if (!emailLimited.ok || !ipLimited.ok) {
    await recordLoginActivity({ attemptedEmail: trimmed, outcome: "rate_limited", ipAddress: ip, userAgent });
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });

  if (error || !signInData.user) {
    await recordLoginActivity({ attemptedEmail: trimmed, outcome: "invalid_credentials", ipAddress: ip, userAgent });
    return { ok: false, error: GENERIC_ERROR };
  }

  // Link team registrations made under this email - only when the account's
  // Auth email is confirmed, using that Auth email (not the typed value or
  // profiles.email). See BUG-002 / BUG-010.
  await linkConfirmedParticipantRows(signInData.user);

  const ctx = await getUserContext();
  await recordLoginActivity({
    attemptedEmail: trimmed,
    profileId: signInData.user.id,
    role: resolveLoginActivityRole(ctx),
    outcome: "success",
    ipAddress: ip,
    userAgent,
  });

  // The mandatory password change always wins over any requested page.
  const landing = defaultLandingPath(ctx);
  if (ctx?.mustChangePassword && !isStaff(ctx)) return { ok: true, redirectTo: landing };
  return { ok: true, redirectTo: safeNextPath(next) ?? landing };
}
