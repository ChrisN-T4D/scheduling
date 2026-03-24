import { prisma } from "@/lib/db";

export async function ensureGlobalSettings() {
  const existing = await prisma.globalSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.globalSettings.create({
    data: { id: 1 },
  });
}

export async function ensureDefaultWeeklyRules() {
  const count = await prisma.weeklyRule.count();
  if (count > 0) return;
  // Mon–Fri 9:00–17:00 (local), dayOfWeek: 1=Mon … 5=Fri in JS: Monday=1
  const days = [1, 2, 3, 4, 5];
  await prisma.weeklyRule.createMany({
    data: days.map((d) => ({
      dayOfWeek: d,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    })),
  });
}
