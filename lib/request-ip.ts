/**
 * Best-effort client IP for rate limiting.
 * On Railway / Vercel / similar, the platform sets X-Forwarded-For from the edge
 * (do not expose this app directly to the internet without a trusted proxy).
 */
export function getClientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}
