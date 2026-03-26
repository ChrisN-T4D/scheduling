import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";
import { decryptString, encryptString } from "@/lib/crypto-secret";
import { getEnv } from "@/lib/env";

const PROVIDER = "google";

export async function isGoogleOAuthConnected(): Promise<boolean> {
  const row = await prisma.storedCredential.findUnique({
    where: { provider: PROVIDER },
  });
  return Boolean(row);
}

/** Returns an OAuth2 client ready for Calendar API calls (access token refreshed if needed). */
export async function getGoogleOAuth2ClientForCalendar(): Promise<OAuth2Client> {
  const env = getEnv();
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set",
    );
  }
  const row = await prisma.storedCredential.findUnique({
    where: { provider: PROVIDER },
  });
  if (!row) {
    throw new Error("Google account is not connected (admin → Connect Google)");
  }
  const refresh = decryptString(row.refreshTokenEnc, env.TOKEN_ENCRYPTION_KEY);
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const redirectUri = `${base}/api/auth/google/callback`;
  const oauth2 = new OAuth2Client(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri,
  );

  const now = Date.now();
  const skewMs = 60_000;
  if (
    row.accessTokenEnc &&
    row.expiresAt &&
    row.expiresAt.getTime() > now + skewMs
  ) {
    oauth2.setCredentials({
      refresh_token: refresh,
      access_token: decryptString(row.accessTokenEnc, env.TOKEN_ENCRYPTION_KEY),
    });
    return oauth2;
  }

  oauth2.setCredentials({ refresh_token: refresh });
  const access = await oauth2.getAccessToken();
  if (!access.token) {
    throw new Error("Google OAuth: could not obtain access token");
  }
  const creds = oauth2.credentials;
  const nextRefresh = creds.refresh_token
    ? encryptString(creds.refresh_token, env.TOKEN_ENCRYPTION_KEY)
    : row.refreshTokenEnc;
  const expiresAt =
    creds.expiry_date != null ? new Date(creds.expiry_date) : null;
  await prisma.storedCredential.update({
    where: { provider: PROVIDER },
    data: {
      refreshTokenEnc: nextRefresh,
      accessTokenEnc: creds.access_token
        ? encryptString(creds.access_token, env.TOKEN_ENCRYPTION_KEY)
        : null,
      expiresAt,
    },
  });
  return oauth2;
}
