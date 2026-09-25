// BUG-029: page query parameters come straight from the URL. Anything that
// isn't a plain positive integer falls back to page 1, and huge values are
// clamped so they can't produce absurd range offsets.
export const MAX_PAGE = 10_000;

export function parsePageParam(raw: string | string[] | undefined | null): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !/^\d{1,6}$/.test(value.trim())) return 1;
  const n = Number.parseInt(value.trim(), 10);
  if (!Number.isSafeInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}
