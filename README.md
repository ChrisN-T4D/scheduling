# Scheduling

Students pick open time slots from your **weekly rules**, minus **Microsoft 365** busy time and existing bookings. Each booking writes an event to **Google Calendar** and invites the student.

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)
- Microsoft identity (PKCE) + Microsoft Graph
- Google Calendar API (service account write access)

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

3. **API permissions** (delegated): `Calendars.Read`, `offline_access`.

4. Put **Application (client) ID** in `MICROSOFT_CLIENT_ID`. Use `MICROSOFT_TENANT_ID=common` or your tenant ID. Add **client secret** in `MICROSOFT_CLIENT_SECRET` if you registered a confidential client.

### Google Calendar

1. Create a Google Cloud service account and enable the Google Calendar API.
2. Share your target calendar with `GOOGLE_CLIENT_EMAIL` and grant **Make changes to events**.
3. Put `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` (single line with `\n` escapes), and `GOOGLE_CALENDAR_ID` in `.env`.
4. Set `MEETING_ROOM_URL` to your constant room link; this is included in booking confirmations and Google events.

## Railway

See **[docs/RAILWAY.md](docs/RAILWAY.md)** for deploy steps (Postgres plugin, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, Entra redirect).

## Docker (app + database)

```bash
cp .env.example .env
# edit .env: TOKEN_ENCRYPTION_KEY, ADMIN_SECRET, MEETING_ROOM_URL, NEXT_PUBLIC_APP_URL, Microsoft + Google Calendar vars
docker compose up --build
```

The web container runs `prisma migrate deploy` before `npm run start`. Ensure `.env` includes all required variables (Microsoft availability + Google Calendar write).

## Project layout

- [`app/book`](app/book) — public booking UI  
- [`app/admin`](app/admin) — password-protected settings, Microsoft connect, weekly rules  
- [`app/api`](app/api) — availability, book, OAuth callback, admin APIs  
- [`lib`](lib) — Graph, Google Calendar, slot math, encryption, env  

## Security notes (summary)

- Full write-up: **[docs/SECURITY.md](docs/SECURITY.md)**.
- Never commit `.env`. `TOKEN_ENCRYPTION_KEY` must decode (base64) to **32 bytes**; it encrypts Microsoft refresh tokens at rest.
- Use HTTPS in production; OAuth redirects must match Entra registration exactly.
- Rotate `ADMIN_SECRET` and client secrets if exposed.
- **Rate limits** (in-memory, per instance): availability, book, and **admin login**. Use a proxy or Redis for global limits if you scale out.
- **Double-booking**: Postgres `pg_advisory_xact_lock` per slot before calendar writes.
- Production adds **security headers** (HSTS, frame denial, nosniff, etc.) via `next.config.ts`.

## Entra redirect URI checklist

| Environment | Redirect URI |
|-------------|----------------|
| Local | `http://localhost:3000/api/auth/microsoft/callback` |
| Production | `https://YOUR_DOMAIN/api/auth/microsoft/callback` |

Add the exact URL under **App registrations → your app → Authentication → Web redirect URIs**.
