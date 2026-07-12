/**
 * src/lib/rate-limit.ts
 *
 * A minimal fixed-window rate limiter, in-memory, per Node process.
 *
 * Honest limitation up front: this is process-local. It's enough to stop
 * an unsophisticated script from brute-forcing coupon codes against a
 * single running instance, but it does NOT enforce a real global limit
 * across multiple serverless instances/regions — each cold-started
 * instance starts its own empty counter map. A production deployment that
 * actually needs a hard, distributed guarantee (rather than "make casual
 * abuse impractical") should swap this for a shared store like Upstash
 * Redis. Kept in-memory here to avoid adding a new infrastructure
 * dependency for what is, for a single-location restaurant's traffic
 * volume, already a meaningful improvement over no rate limiting at all.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Prevent unbounded memory growth from an endless stream of distinct IPs
// (or spoofed X-Forwarded-For values) each getting their own bucket
// forever — sweep expired entries out periodically instead of on every
// request.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();
function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function getClientIp(request: Request): string {
  // Behind Vercel/most reverse proxies, the real client IP is the first
  // entry in X-Forwarded-For. This is spoofable by anyone calling the
  // origin directly, which is an accepted gap for the same reason noted
  // above — this limiter aims to deter casual scripted abuse, not act as
  // a security boundary on its own.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(
  request: Request,
  scope: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  sweepExpired(now);

  const key = `${scope}:${getClientIp(request)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
