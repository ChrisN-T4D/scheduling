import { createHash, randomBytes } from "node:crypto";
import { requireMicrosoftConfig } from "@/lib/env";

const SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Calendars.Read",
].join(" ");

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(
    createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

export function generateOAuthState(): string {
  return base64url(randomBytes(24));
}

export function buildMicrosoftAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const { clientId, tenantId } = requireMicrosoftConfig();
  const u = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  );
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_mode", "query");
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("state", params.state);
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret, tenantId } = requireMicrosoftConfig();
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const form = new URLSearchParams(body);
  form.set("client_id", clientId);
  if (clientSecret) {
    form.set("client_secret", clientSecret);
  }
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token error ${res.status}: ${text}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function exchangeMicrosoftCode(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  return postToken({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
}

export async function refreshMicrosoftToken(
  refreshToken: string,
): Promise<TokenResponse> {
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}
