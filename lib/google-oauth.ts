import { OAuth2Client } from "google-auth-library";
import { getEnv } from "@/lib/env";

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
];

export function requireGoogleOAuthClientEnv() {
  const e = getEnv();
  if (!e.GOOGLE_OAUTH_CLIENT_ID || !e.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error(
      "Google OAuth is not configured: set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET",
    );
  }
  return {
    clientId: e.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: e.GOOGLE_OAUTH_CLIENT_SECRET,
  };
}

export function getGoogleOAuthRedirectUri(): string {
  const base = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

export function createGoogleOAuth2Client(): OAuth2Client {
  const { clientId, clientSecret } = requireGoogleOAuthClientEnv();
  return new OAuth2Client(clientId, clientSecret, getGoogleOAuthRedirectUri());
}

export function buildGoogleAuthorizeUrl(state: string): string {
  const oauth2 = createGoogleOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_OAUTH_SCOPES,
    prompt: "consent",
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeGoogleAuthCode(code: string) {
  const oauth2 = createGoogleOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}
