import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE = "admin_session";

export async function createAdminToken(adminSecret: string): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(adminSecret));
}

export async function verifyAdminToken(
  token: string,
  adminSecret: string,
): Promise<boolean> {
  try {
    await jwtVerify(token, new TextEncoder().encode(adminSecret));
    return true;
  } catch {
    return false;
  }
}
