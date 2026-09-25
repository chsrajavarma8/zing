import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Rate limiting (RISK-002).
//
// sharedRateLimit() is the primary limiter: it counts hits in Postgres via
// the service-role-only rate_limit_hit() function (0043_security_integrity_fixes.sql),
// so every serverless instance shares the same counters. Keys are SHA-256
// hashed before leaving this process, so no raw email or IP is stored.
//
// If the database call itself fails, it falls back to the per-instance
// in-memory limiter below rather than either blocking every request or
// letting everything through unchecked.
const buckets = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 50_000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs?: number;
}

export function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return { ok: false, retryAfterMs: windowMs - (now - timestamps[0]) };
  }

  if (!buckets.has(key) && buckets.size >= MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { ok: true };
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function sharedRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_bucket: hashKey(key),
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    if (error) throw error;
    const row = (data as { allowed: boolean; retry_after_seconds: number }[] | null)?.[0];
    if (!row) throw new Error("rate_limit_hit returned no row");
    return row.allowed ? { ok: true } : { ok: false, retryAfterMs: row.retry_after_seconds * 1000 };
  } catch (err) {
    console.error("[rate-limit] shared limiter unavailable, using per-instance fallback:", err);
    return memoryRateLimit(key, limit, windowMs);
  }
}

// Client IP as seen by the platform. On Vercel, x-forwarded-for is set by the
// edge (the left-most value is the real client); x-real-ip is the fallback.
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}
