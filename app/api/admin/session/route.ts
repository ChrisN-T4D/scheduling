import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminToken, ADMIN_COOKIE } from "@/lib/admin-session";
import { getEnv } from "@/lib/env";
import { allowRateLimit, rateLimitRetryAfterSec } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 20;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (
    !allowRateLimit({
      key: `admin-login:${ip}`,
      limit: LOGIN_MAX_ATTEMPTS,
      windowMs: LOGIN_WINDOW_MS,
    })
  ) {
    return NextResponse.json(
      { error: "Too many login attempts" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitRetryAfterSec(LOGIN_WINDOW_MS)),
        },
      },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const env = getEnv();
  if (!body.password || body.password !== env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const token = await createAdminToken(env.ADMIN_SECRET);
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, COOKIE_OPTS);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
