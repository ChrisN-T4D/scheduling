import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthorizeUrl, requireGoogleOAuthClientEnv } from "@/lib/google-oauth";
import { generateOAuthState } from "@/lib/microsoft-auth";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function GET() {
  try {
    requireGoogleOAuthClientEnv();
    const state = generateOAuthState();
    const url = buildGoogleAuthorizeUrl(state);
    const jar = await cookies();
    jar.set("google_oauth_state", state, COOKIE_OPTS);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
