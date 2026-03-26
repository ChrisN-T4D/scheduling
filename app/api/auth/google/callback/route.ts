import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encryptString } from "@/lib/crypto-secret";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { exchangeGoogleAuthCode } from "@/lib/google-oauth";

const PROVIDER = "google";

export async function GET(request: Request) {
  const env = getEnv();
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const jar = await cookies();
  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  const desc = url.searchParams.get("error_description");
  if (err) {
    jar.delete("google_oauth_state");
    const q = new URLSearchParams({
      google_error: desc ?? err,
    });
    return NextResponse.redirect(`${base}/admin?${q}`);
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = jar.get("google_oauth_state")?.value;
  jar.delete("google_oauth_state");
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(
      `${base}/admin?google_error=${encodeURIComponent("Invalid OAuth state")}`,
    );
  }
  try {
    const tokens = await exchangeGoogleAuthCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${base}/admin?google_error=${encodeURIComponent(
          "No refresh token — try again; Google only returns it once unless you use prompt=consent",
        )}`,
      );
    }
    const now = Date.now();
    const expiresAt =
      tokens.expiry_date != null
        ? new Date(tokens.expiry_date)
        : tokens.access_token
          ? new Date(now + 3600 * 1000)
          : null;
    await prisma.storedCredential.upsert({
      where: { provider: PROVIDER },
      create: {
        provider: PROVIDER,
        refreshTokenEnc: encryptString(
          tokens.refresh_token,
          env.TOKEN_ENCRYPTION_KEY,
        ),
        accessTokenEnc: tokens.access_token
          ? encryptString(tokens.access_token, env.TOKEN_ENCRYPTION_KEY)
          : null,
        expiresAt,
      },
      update: {
        refreshTokenEnc: encryptString(
          tokens.refresh_token,
          env.TOKEN_ENCRYPTION_KEY,
        ),
        accessTokenEnc: tokens.access_token
          ? encryptString(tokens.access_token, env.TOKEN_ENCRYPTION_KEY)
          : null,
        expiresAt,
      },
    });
    return NextResponse.redirect(`${base}/admin?google_connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      `${base}/admin?google_error=${encodeURIComponent(msg)}`,
    );
  }
}
