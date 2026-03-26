# Deploy on Railway

## 1. Create the project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → select this repo.
2. **Add** → **Database** → **PostgreSQL**.

## 2. Wire Postgres to the app

1. Open your **web service** (the Next.js app).
2. **Variables** → **Add variable** → **Reference** → choose the Postgres plugin’s `DATABASE_URL` (Railway shows this as a reference like `${{Postgres.DATABASE_URL}}`).

Alternatively copy `DATABASE_URL` from the Postgres service **Connect** tab into the web service variables.

## 3. Required environment variables

Set these on the **web** service (same names as [`.env.example`](../.env.example)):

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | From Postgres (reference or paste). |
| `NEXT_PUBLIC_APP_URL` | Your public URL **without** a trailing slash, e.g. `https://your-app.up.railway.app`. |
| `TOKEN_ENCRYPTION_KEY` | Base64, **exactly 32 bytes** when decoded. |
| `ADMIN_SECRET` | Strong password (min 8 chars). |
| `MEETING_ROOM_URL` | Constant room link to include in bookings/events. |
| `OUTLOOK_ICS_URL` | Optional Outlook ICS feed URL for busy-time blocking. |
| `MICROSOFT_CLIENT_ID` | Optional: Entra app client ID (if using OAuth instead of ICS). |
| `MICROSOFT_TENANT_ID` | Optional: `common` or your tenant ID. |
| `MICROSOFT_CLIENT_SECRET` | Optional (confidential client). |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth Web client ID (for calendar invites). |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth Web client secret. |
| `GOOGLE_CALENDAR_ID` | Optional; target calendar (`primary` default). |
| `GOOGLE_CLIENT_EMAIL` | Optional fallback: service account email (if not using OAuth). |
| `GOOGLE_PRIVATE_KEY` | Optional fallback: service account key (single-line, `\n` escaped). |

Railway sets **`PORT`** automatically; Next.js uses it. You do not need to set `PORT` manually.

## 4. Public URL

**Settings** → **Networking** → **Generate Domain**. Put that URL (with `https://`) into `NEXT_PUBLIC_APP_URL`.

## 5. OAuth redirect URIs

**Microsoft Entra** — add this **exact** URI under **Authentication**:

`{NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`

**Google Cloud** — under your OAuth Web client, add **Authorized redirect URI**:

`{NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

After deploy, open **Admin** → **Connect Google** once to store the refresh token.

## 6. Build & start

This repo includes [`railway.toml`](../railway.toml):

- **Build:** [Railpack](https://docs.railway.com/builds/railpack) analyzes the repo, installs dependencies, and runs `npm run build` (Next.js). Optional [`railpack.json`](../railpack.json) pins **Node 22** and installs **OpenSSL** (apt) for Prisma. TypeScript, Tailwind, PostCSS, ESLint, `dotenv` (for `prisma.config.ts`), and `@types/*` are in **`dependencies`** so production installs still have everything needed for `postinstall` / `prisma generate` and `next build`.
- **Pre-deploy:** `npx prisma migrate deploy` (runs before the new revision receives traffic).
- **Start:** `npm run start` (`next start -H 0.0.0.0` so the server listens on all interfaces for Railway’s health checks).

There is **no** root `Dockerfile` so Railway does not auto-switch to Dockerfile builds; local **Docker Compose** uses [`Dockerfile.compose`](../Dockerfile.compose) instead.

### Deploy failed?

- **Build errors about TypeScript / tailwind / postcss / dotenv:** use the latest `package.json` from `main` (build tools must be in `dependencies`, not only `devDependencies`).
- **`DATABASE_URL`:** must be set on the **web** service before `prisma migrate deploy` runs at start (reference the Postgres plugin’s variable).
- **`NEXT_PUBLIC_APP_URL`:** must be your real `https://…` Railway URL (no trailing slash); mismatches break OAuth redirects.

First deploy applies migrations; ensure `DATABASE_URL` is available before the start command runs (it is if referenced on the same service).

## 7. Optional: deploy with Docker on Railway

Rename or copy [`Dockerfile.compose`](../Dockerfile.compose) to `Dockerfile` at the repo root (or set **`dockerfilePath`** in `railway.toml`), then set:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
```

Adjust the path if your Dockerfile lives elsewhere. The compose Dockerfile runs migrations then `npm run start`.

## 8. CLI (optional)

```bash
npm i -g @railway/cli
railway login
railway link
railway variables
railway logs
```

`railway run npm run dev` runs locally with Railway-injected env (watch which `DATABASE_URL` you use).
