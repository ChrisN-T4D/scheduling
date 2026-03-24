import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminUnauthorizedResponse } from "@/lib/admin-guard";
import { ensureDefaultWeeklyRules } from "@/lib/settings";
import { z } from "zod";

const createSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(24 * 60 - 1),
  endMinute: z.number().int().min(1).max(24 * 60),
});

export async function GET() {
  const denied = await adminUnauthorizedResponse();
  if (denied) return denied;
  await ensureDefaultWeeklyRules();
  const rules = await prisma.weeklyRule.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const denied = await adminUnauthorizedResponse();
  if (denied) return denied;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (parsed.data.endMinute <= parsed.data.startMinute) {
    return NextResponse.json(
      { error: "endMinute must be greater than startMinute" },
      { status: 400 },
    );
  }
  const rule = await prisma.weeklyRule.create({ data: parsed.data });
  return NextResponse.json({ rule });
}

export async function DELETE(request: Request) {
  const denied = await adminUnauthorizedResponse();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await prisma.weeklyRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
