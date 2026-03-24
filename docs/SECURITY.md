# Security notes

## What the app does well

- **Secrets** stay in environment variables; [`.gitignore`](../.gitignore) excludes `.env` (with [`.env.example`](../.env.example) as a template only).
- **Microsoft OAuth** redirects only to `{NEXT_PUBLIC_APP_URL}/admin` with query params derived from Entra — no arbitrary open redirect.
- **PKCE** is used for Microsoft authorization (`lib/microsoft-auth.ts`).
- **Admin session** uses signed JWTs in an **httpOnly** cookie; **Secure** in production; **SameSite=Lax** (`app/api/admin/session/route.ts`).
- **Microsoft refresh tokens** are encrypted (AES-256-GCM) before storage (`lib/crypto-secret.ts`); `TOKEN_ENCRYPTION_KEY` must decode from base64 to **32 bytes** (`lib/env.ts`).
- **Booking** uses a **Postgres advisory lock** per slot to prevent double-booking (`app/api/book/route.ts`).
- **Input validation** on APIs via Zod (`/api/book`, admin routes).
- **SQL** goes through Prisma; raw SQL is only `pg_advisory_xact_lock` with **integer** parameters (not user-controlled strings).
- **HTML** in calendar invites escapes student-controlled strings (`escapeHtml` in `app/api/book/route.ts`).
- **Rate limits** (in-memory): public availability (~120 / 5 min / IP), book (~20 / 15 min / IP), admin login (~20 / 15 min / IP) (`lib/rate-limit.ts`, API routes).
- **HTTP response headers** (production): frame denial, nosniff, referrer policy, permissions policy, HSTS (`next.config.ts`).

## Limits and tradeoffs

- **Rate limits** are **per running Node process**. Multiple instances (or serverless) do not share counters; use a reverse proxy or Redis if you need global limits.
- **Client IP** for rate limiting comes from `X-Forwarded-For` / `X-Real-IP` (`lib/request-ip.ts`). On Railway, the platform sets these; do not expose the app **without** a trusted reverse proxy, or clients could spoof IPs (mitigated on Railway’s edge for typical traffic).
- **Public `/api/book`** is unauthenticated; abuse is partially mitigated by rate limits. For heavy abuse, add CAPTCHA, API keys, or WAF rules at the edge.
- **Admin password** is a single shared secret; use a long random value and rotate if leaked.
- **Zoom Server-to-Server** credentials are powerful; scope the Zoom app minimally and rotate secrets on compromise.

## Ongoing hygiene

- Run **`npm audit`** regularly; apply patches for transitive vulnerabilities when practical.
- Keep **Node** and **dependencies** updated (`package.json` `engines` and `railpack.json` help Railway’s Railpack builder pick a sane Node version).
- Use **HTTPS only** in production (Railway provides TLS); HSTS is enabled in production via `next.config.ts`.

## Reporting

If you find a security issue in this project, contact the repository owner privately.
