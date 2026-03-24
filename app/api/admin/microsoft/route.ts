import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminUnauthorizedResponse } from "@/lib/admin-guard";

export async function DELETE() {
  const denied = await adminUnauthorizedResponse();
  if (denied) return denied;
  await prisma.storedCredential.deleteMany({
    where: { provider: "microsoft" },
  });
  return NextResponse.json({ ok: true });
}
