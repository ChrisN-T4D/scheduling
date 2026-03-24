import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encryptString } from "@/lib/crypto-secret";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { exchangeMicrosoftCode } from "@/lib/microsoft-auth";

const PROVIDER = "microsoft";

export async function GET(request: Request) {
  const env = getEnv();
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const jar = await cookies();
  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  const desc = url.searchParams.get("error_description");
  if (err) {
    jar.delete("ms_oauth_state");
    jar.delete("ms_oauth_verifier");
    const q = new URLSearchParams({
      ms_error: desc ?? err,
    });
    return NextResponse.redirect(`${base}/admin?${q}`);
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = jar.get("ms_oauth_state")?.value;
  const verifier = jar.get("ms_oauth_verifier")?.value;
  jar.delete("ms_oauth_state");
  jar.delete("ms_oauth_verifier");
  if (!code || !state || !verifier || state !== savedState) {
    return NextResponse.redirect(
      `${base}/admin?ms_error=${encodeURIComponent("Invalid OAuth state")}`,
    );
  }
  const redirectUri = `${base}/api/auth/microsoft/callback`;
  try {
    const tokens = await exchangeMicrosoftCode({
      code,
      redirectUri,
      codeVerifier: verifier,
    });
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${base}/admin?ms_error=${encodeURIComponent("No refresh token — ensure offline_access scope and re-consent")}`,
      );
    }
    const now = Date.now();
    const expiresAt = new Date(now + tokens.expires_in * 1000);
    await prisma.storedCredential.upsert({
      where: { provider: PROVIDER },
      create: {
        provider: PROVIDER,
        refreshTokenEnc: encryptString(
          tokens.refresh_token,
          env.TOKEN_ENCRYPTION_KEY,
        ),
        accessTokenEnc: encryptString(
          tokens.access_token,
          env.TOKEN_ENCRYPTION_KEY,
        ),
        expiresAt,
      },
      update: {
        refreshTokenEnc: encryptString(
          tokens.refresh_token,
          env.TOKEN_ENCRYPTION_KEY,
        ),
        accessTokenEnc: encryptString(
          tokens.access_token,
          env.TOKEN_ENCRYPTION_KEY,
        ),
        expiresAt,
      },
    });
    return NextResponse.redirect(`${base}/admin?ms_connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      `${base}/admin?ms_error=${encodeURIComponent(msg)}`,
    );
  }
}
