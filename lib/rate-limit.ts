type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const MAX_KEYS = 50_000;

function prune(now: number) {
  if (store.size <= MAX_KEYS) return;
  for (const [k, b] of store) {
    if (b.resetAt < now) store.delete(k);
  }
}

/**
 * Fixed-window counter. Returns true if under limit, false if rate-limited.
 */
export function allowRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): boolean {
  const now = Date.now();
  prune(now);
  const b = store.get(params.key);
  if (!b || now >= b.resetAt) {
    store.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return true;
  }
  if (b.count >= params.limit) return false;
  b.count += 1;
  return true;
}

export function rateLimitRetryAfterSec(windowMs: number): number {
  return Math.ceil(windowMs / 1000);
}
