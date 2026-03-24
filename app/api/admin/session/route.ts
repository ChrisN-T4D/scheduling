import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminToken, ADMIN_COOKIE } from "@/lib/admin-session";
import { getEnv } from "@/lib/env";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};

export async function POST(request: Request) {
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
