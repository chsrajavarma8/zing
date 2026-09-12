import "server-only";

// Minimal in-memory sliding-window rate limiter.
//
// KNOWN LIMITATION (security audit, not yet fixed): this state is per
// Node.js instance, not shared. On a multi-instance/serverless deployment
// (e.g. Vercel with concurrent instances) each instance has its own
// independent counters, so the effective limit is (configured limit) x
// (instance count) - a distributed brute-force or registration-flood
// attempt is undercounted. This needs Upstash Redis
// (`vercel integration add upstash`) or equivalent shared storage before
// this app is exposed to real internet traffic at scale; swap the body of
// rateLimit() for a Redis-backed version with the same call signature.
//
// This file also bounds its own memory: unlimited distinct keys (e.g. an
// attacker cycling through many fake email addresses) would otherwise grow
// this Map forever, since entries are only pruned lazily on the same key
// being reused. A hard cap turns that into "rate limiting degrades" rather
// than "the process runs out of memory".
const buckets = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 50_000;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    const retryAfterMs = windowMs - (now - timestamps[0]);
    buckets.set(key, timestamps);
    return { ok: false, retryAfterMs };
  }

  if (!buckets.has(key) && buckets.size >= MAX_TRACKED_KEYS) {
    // Fail open rather than crash: an attacker flooding distinct keys
    // degrades rate limiting for new keys instead of taking the process
    // down. The oldest-inserted key is evicted to make room.
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { ok: true };
}
