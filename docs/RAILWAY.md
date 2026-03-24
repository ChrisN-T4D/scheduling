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
| `MICROSOFT_CLIENT_ID` | Entra app client ID. |
| `MICROSOFT_TENANT_ID` | `common` or your tenant ID. |
| `MICROSOFT_CLIENT_SECRET` | Optional (confidential client). |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Zoom Server-to-Server OAuth app. |

Railway sets **`PORT`** automatically; Next.js uses it. You do not need to set `PORT` manually.

## 4. Public URL

**Settings** → **Networking** → **Generate Domain**. Put that URL (with `https://`) into `NEXT_PUBLIC_APP_URL`.

## 5. Microsoft Entra redirect URI

Add this **exact** redirect URI in Entra → your app → **Authentication**:

`{NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`

## 6. Build & start

This repo includes [`railway.toml`](../railway.toml):

- **Build:** Nixpacks — `npm ci` + `npm run build`. [`nixpacks.toml`](../nixpacks.toml) adds **openssl** for Prisma.
- **Start:** `npx prisma migrate deploy && npm run start`.

`package.json` **`engines.node`** is `>=22 <23`. If the build uses an older Node, set **`NIXPACKS_NODE_VERSION=22`** on the Railway service.

First deploy applies migrations; ensure `DATABASE_URL` is available before the start command runs (it is if referenced on the same service).

## 7. Optional: deploy with Docker instead

In `railway.toml`, change:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
```

Remove or ignore `nixpacks.toml` for that service. The repo [`Dockerfile`](../Dockerfile) runs migrations then `npm run start`.

## 8. CLI (optional)

```bash
npm i -g @railway/cli
railway login
railway link
railway variables
railway logs
```

`railway run npm run dev` runs locally with Railway-injected env (watch which `DATABASE_URL` you use).
