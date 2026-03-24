import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  buildMicrosoftAuthorizeUrl,
  generateOAuthState,
  generatePkcePair,
} from "@/lib/microsoft-auth";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function GET() {
  try {
    const env = getEnv();
    const { verifier, challenge } = generatePkcePair();
    const state = generateOAuthState();
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/auth/microsoft/callback`;
    const url = buildMicrosoftAuthorizeUrl({
      redirectUri,
      state,
      codeChallenge: challenge,
    });
    const jar = await cookies();
    jar.set("ms_oauth_state", state, COOKIE_OPTS);
    jar.set("ms_oauth_verifier", verifier, COOKIE_OPTS);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
