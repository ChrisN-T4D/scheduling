import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-session";
import { getEnv } from "@/lib/env";

export async function adminUnauthorizedResponse(): Promise<NextResponse | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (
    !token ||
    !(await verifyAdminToken(token, getEnv().ADMIN_SECRET))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
