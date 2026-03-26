import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchBusyFromIcs } from "@/lib/ics-busy";
import { getEnv } from "@/lib/env";
import { computeAvailableSlots } from "@/lib/slots";
import { ensureDefaultWeeklyRules, ensureGlobalSettings } from "@/lib/settings";
import { allowRateLimit, rateLimitRetryAfterSec } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQ = 120;
const MAX_RANGE_MS = 45 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (
    !allowRateLimit({
      key: `avail:${ip}`,
      limit: MAX_REQ,
      windowMs: WINDOW_MS,
    })
  ) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitRetryAfterSec(WINDOW_MS)),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const slotMinutesRaw = searchParams.get("slotMinutes");
  if (!from || !to) {
    return NextResponse.json(
      { error: "Query params from and to (ISO date) are required" },
      { status: 400 },
    );
  }
  const rangeStartUtc = new Date(from);
  const rangeEndUtc = new Date(to);
  if (
    Number.isNaN(rangeStartUtc.getTime()) ||
    Number.isNaN(rangeEndUtc.getTime())
  ) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (rangeEndUtc <= rangeStartUtc) {
    return NextResponse.json({ error: "to must be after from" }, { status: 400 });
  }
  if (rangeEndUtc.getTime() - rangeStartUtc.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: "Date range too large (max 45 days)" },
      { status: 400 },
    );
  }

  await ensureGlobalSettings();
  await ensureDefaultWeeklyRules();
  const settings = await prisma.globalSettings.findUniqueOrThrow({
    where: { id: 1 },
  });
  const requestedSlotMinutes =
    slotMinutesRaw == null ? undefined : Number(slotMinutesRaw);
  if (
    requestedSlotMinutes != null &&
    (!Number.isFinite(requestedSlotMinutes) ||
      requestedSlotMinutes < 5 ||
      requestedSlotMinutes > 480)
  ) {
    return NextResponse.json(
      { error: "slotMinutes must be a number between 5 and 480" },
      { status: 400 },
    );
  }
  const slotMinutes = requestedSlotMinutes ?? settings.slotMinutes;
  const rules = await prisma.weeklyRule.findMany();

  const env = getEnv();
  const icsUrl = env.OUTLOOK_ICS_URL;
  let busy: { start: Date; end: Date }[] = [];
  if (icsUrl) {
    try {
      busy = await fetchBusyFromIcs({
        icsUrl,
        startUtc: rangeStartUtc,
        endUtc: rangeEndUtc,
      });
    } catch (e) {
      console.error("ICS busy fetch failed:", e);
      return NextResponse.json(
        {
          error:
            "Could not load busy times from ICS feed. Check OUTLOOK_ICS_URL or try again.",
        },
        { status: 503 },
      );
    }
  }

  const bookings = await prisma.booking.findMany({
    where: {
      AND: [
        { startUtc: { lt: rangeEndUtc } },
        { endUtc: { gt: rangeStartUtc } },
      ],
    },
  });

  const slots = computeAvailableSlots({
    rangeStartUtc,
    rangeEndUtc,
    timezone: settings.timezone,
    slotMinutes,
    bufferMinutes: settings.bufferMinutes,
    rules,
    busyUtc: busy,
    bookingsUtc: bookings.map((b) => ({
      start: b.startUtc,
      end: b.endUtc,
    })),
  });

  return NextResponse.json({
    timezone: settings.timezone,
    slotMinutes,
    busyFeedConfigured: Boolean(icsUrl),
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
    })),
  });
}
