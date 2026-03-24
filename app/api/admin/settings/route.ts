import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminUnauthorizedResponse } from "@/lib/admin-guard";
import { ensureGlobalSettings } from "@/lib/settings";
import { isMicrosoftConnected } from "@/lib/microsoft-graph";
import { z } from "zod";

const patchSchema = z.object({
  timezone: z.string().min(1).optional(),
  slotMinutes: z.number().int().min(5).max(480).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
});

export async function GET() {
  const denied = await adminUnauthorizedResponse();
  if (denied) return denied;
  await ensureGlobalSettings();
  const settings = await prisma.globalSettings.findUniqueOrThrow({
    where: { id: 1 },
  });
  const microsoftConnected = await isMicrosoftConnected();
  return NextResponse.json({ settings, microsoftConnected });
}

export async function PATCH(request: Request) {
  const denied = await adminUnauthorizedResponse();
  if (denied) return denied;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  await ensureGlobalSettings();
  const settings = await prisma.globalSettings.update({
    where: { id: 1 },
    data: parsed.data,
  });
  return NextResponse.json({ settings });
}
