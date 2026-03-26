import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminUnauthorizedResponse } from "@/lib/admin-guard";
import { fetchBusyFromIcs } from "@/lib/ics-busy";
import { getEnv } from "@/lib/env";

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const denied = await adminUnauthorizedResponse();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
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
    Number.isNaN(rangeEndUtc.getTime()) ||
    rangeEndUtc <= rangeStartUtc
  ) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (rangeEndUtc.getTime() - rangeStartUtc.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: "Date range too large (max 31 days)" },
      { status: 400 },
    );
  }

  const env = getEnv();
  const icsUrl = env.OUTLOOK_ICS_URL;

  const [bookings, icsBusy] = await Promise.all([
    prisma.booking.findMany({
      where: {
        AND: [
          { startUtc: { lt: rangeEndUtc } },
          { endUtc: { gt: rangeStartUtc } },
        ],
      },
      orderBy: [{ startUtc: "asc" }],
    }),
    icsUrl
      ? fetchBusyFromIcs({
          icsUrl,
          startUtc: rangeStartUtc,
          endUtc: rangeEndUtc,
        })
      : Promise.resolve([]),
  ]);

  const events = [
    ...icsBusy.map((b, i) => ({
      id: `ics-${b.start.toISOString()}-${i}`,
      source: "ics" as const,
      title: "Busy (ICS)",
      start: b.start.toISOString(),
      end: b.end.toISOString(),
    })),
    ...bookings.map((b) => ({
      id: `booking-${b.id}`,
      source: "booking" as const,
      title: `Booked — ${b.studentName}`,
      studentName: b.studentName,
      studentEmail: b.studentEmail,
      start: b.startUtc.toISOString(),
      end: b.endUtc.toISOString(),
      meetingUrl: b.zoomJoinUrl ?? undefined,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({
    busyFeedConfigured: Boolean(icsUrl),
    events,
  });
}
