# Scheduling

Students pick open time slots from your **weekly rules**, minus **Microsoft 365** busy time and existing bookings. Each booking creates a **Zoom** meeting and an **Outlook/Graph** event with the student as an attendee (calendar invite email).

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)
- Microsoft identity (PKCE) + Microsoft Graph
- Zoom **Server-to-Server OAuth** (account credentials)

## Local development

1. Copy [`.env.example`](.env.example) to `.env` and fill values.

2. Generate a 32-byte encryption key (for refresh tokens at rest):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. Start Postgres (or use Docker only for DB):

   ```bash
   docker compose up -d db
   ```

4. Apply migrations and run the app:

   ```bash
   npx prisma migrate deploy
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) — **Admin** uses `ADMIN_SECRET`; **Book** is public.

### Microsoft Entra (Azure AD)

1. Register an app → add redirect URI:  
   `{NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`  
   (for local dev: `http://localhost:3000/api/auth/microsoft/callback`).

2. **Authentication** → allow public client flows if you are not using a client secret (optional).

3. **API permissions** (delegated): `User.Read`, `Calendars.Read`, `Calendars.ReadWrite`, `offline_access`, plus openid/profile.

4. Put **Application (client) ID** in `MICROSOFT_CLIENT_ID`. Use `MICROSOFT_TENANT_ID=common` or your tenant ID. Add **client secret** in `MICROSOFT_CLIENT_SECRET` if you registered a confidential client.

### Zoom

Create a **Server-to-Server OAuth** app in the Zoom Marketplace. Use **Account ID**, **Client ID**, and **Client Secret** in `.env`.

## Docker (app + database)

```bash
cp .env.example .env
# edit .env: TOKEN_ENCRYPTION_KEY, ADMIN_SECRET, NEXT_PUBLIC_APP_URL, Zoom + optional Microsoft
docker compose up --build
```

The web container runs `prisma migrate deploy` before `npm run start`. Ensure `.env` includes all required variables (Microsoft/Zoom can be added later; booking requires both).

## Project layout

- [`app/book`](app/book) — public booking UI  
- [`app/admin`](app/admin) — password-protected settings, Microsoft connect, weekly rules  
- [`app/api`](app/api) — availability, book, OAuth callback, admin APIs  
- [`lib`](lib) — Graph, Zoom, slot math, encryption, env  

## Security notes

- Never commit `.env`. `TOKEN_ENCRYPTION_KEY` protects stored Microsoft refresh tokens.
- Use HTTPS in production; OAuth redirects must match Entra registration exactly.
- Rotate `ADMIN_SECRET` and client secrets if exposed.
- **Rate limits** (in-memory, per server instance): `/api/availability` ~120 requests / 5 minutes / IP; `/api/book` ~20 / 15 minutes / IP. For multiple app replicas, put a shared reverse proxy rate limit or Redis-based limiter in front.
- **Double-booking**: the same slot is reserved in Postgres with `pg_advisory_xact_lock` before Zoom/Graph run, so concurrent requests cannot both claim the same start/end.

## Entra redirect URI checklist

| Environment | Redirect URI |
|-------------|----------------|
| Local | `http://localhost:3000/api/auth/microsoft/callback` |
| Production | `https://YOUR_DOMAIN/api/auth/microsoft/callback` |

Add the exact URL under **App registrations → your app → Authentication → Web redirect URIs**.
