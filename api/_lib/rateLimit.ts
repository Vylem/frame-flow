const WINDOW_SECONDS = 3600; // 1 hour
const MAX_REQUESTS   = 10;   // per IP per window

/**
 * Sliding-window rate limiter backed by Vercel KV.
 * Returns true (allowed) or false (rate-limited).
 * Degrades gracefully — returns true if KV is not configured or not installed.
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  if (!process.env.KV_REST_API_URL) return true; // KV not set up — skip

  try {
    const { kv } = await import('@vercel/kv'); // dynamic — won't crash if not installed
    const key   = `rate:upload:${ip}`;
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, WINDOW_SECONDS);
    return count <= MAX_REQUESTS;
  } catch {
    return true; // fail open — don't block legitimate traffic on KV errors
  }
}
