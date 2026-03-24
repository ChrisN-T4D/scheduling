import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createCalendarEventWithZoom,
  fetchCalendarBusy,
} from "@/lib/microsoft-graph";
import { createZoomMeeting, deleteZoomMeeting } from "@/lib/zoom";
import { computeAvailableSlots } from "@/lib/slots";
import { ensureDefaultWeeklyRules, ensureGlobalSettings } from "@/lib/settings";
import { slotAdvisoryKeys } from "@/lib/booking-lock";
import { allowRateLimit, rateLimitRetryAfterSec } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const bodySchema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  studentName: z.string().min(1).max(200),
  studentEmail: z.string().email(),
  notes: z.string().max(2000).optional(),
});

const BOOK_WINDOW_MS = 15 * 60 * 1000;
const BOOK_MAX = 20;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (
    !allowRateLimit({
      key: `book:${ip}`,
      limit: BOOK_MAX,
      windowMs: BOOK_WINDOW_MS,
    })
  ) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitRetryAfterSec(BOOK_WINDOW_MS)),
        },
      },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const startUtc = new Date(parsed.data.start);
  const endUtc = new Date(parsed.data.end);
  if (endUtc <= startUtc) {
    return NextResponse.json({ error: "Invalid slot times" }, { status: 400 });
  }

  const ms = await prisma.storedCredential.findUnique({
    where: { provider: "microsoft" },
  });
  if (!ms) {
    return NextResponse.json(
      { error: "Scheduling is not configured (Microsoft calendar)." },
      { status: 503 },
    );
  }

  await ensureGlobalSettings();
  await ensureDefaultWeeklyRules();
  const settings = await prisma.globalSettings.findUniqueOrThrow({
    where: { id: 1 },
  });
  const rules = await prisma.weeklyRule.findMany();

  const padMs = 60_000;
  const busy = await fetchCalendarBusy({
    startUtc: new Date(startUtc.getTime() - padMs),
    endUtc: new Date(endUtc.getTime() + padMs),
  });
  const bookings = await prisma.booking.findMany({
    where: {
      AND: [{ startUtc: { lt: endUtc } }, { endUtc: { gt: startUtc } }],
    },
  });
  const free = computeAvailableSlots({
    rangeStartUtc: startUtc,
    rangeEndUtc: endUtc,
    timezone: settings.timezone,
    slotMinutes: settings.slotMinutes,
    bufferMinutes: settings.bufferMinutes,
    rules,
    busyUtc: busy,
    bookingsUtc: bookings.map((b) => ({
      start: b.startUtc,
      end: b.endUtc,
    })),
  });
  const match = free.find(
    (s) =>
      s.start.getTime() === startUtc.getTime() &&
      s.end.getTime() === endUtc.getTime(),
  );
  if (!match) {
    return NextResponse.json(
      { error: "This time slot is no longer available." },
      { status: 409 },
    );
  }

  let reservedId: string | null = null;
  let zoomId: string | null = null;

  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const [k1, k2] = slotAdvisoryKeys(startUtc, endUtc);
        await tx.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock($1::int, $2::int)",
          k1,
          k2,
        );
        const overlap = await tx.booking.findFirst({
          where: {
            AND: [
              { startUtc: { lt: endUtc } },
              { endUtc: { gt: startUtc } },
            ],
          },
        });
        if (overlap) {
          const err = new Error("SLOT_TAKEN");
          (err as Error & { code: string }).code = "SLOT_TAKEN";
          throw err;
        }
        return tx.booking.create({
          data: {
            startUtc,
            endUtc,
            studentEmail: parsed.data.studentEmail,
            studentName: parsed.data.studentName,
            notes: parsed.data.notes ?? null,
          },
        });
      },
      { maxWait: 15_000, timeout: 15_000 },
    );
    reservedId = booking.id;

    const meeting = await createZoomMeeting({
      topic: `Session — ${parsed.data.studentName}`,
      startUtc,
      durationMinutes: Math.round(
        (endUtc.getTime() - startUtc.getTime()) / 60_000,
      ),
      agenda: parsed.data.notes,
    });
    zoomId = meeting.id;

    const htmlBody = `
<p>Hi ${escapeHtml(parsed.data.studentName)},</p>
<p>Your scheduled session is confirmed.</p>
<p><strong>Join Zoom:</strong> <a href="${meeting.join_url}">${meeting.join_url}</a></p>
${parsed.data.notes ? `<p><strong>Notes:</strong> ${escapeHtml(parsed.data.notes)}</p>` : ""}
`;
    const graphEventId = await createCalendarEventWithZoom({
      subject: `Session — ${parsed.data.studentName}`,
      startUtc,
      endUtc,
      studentEmail: parsed.data.studentEmail,
      studentName: parsed.data.studentName,
      zoomJoinUrl: meeting.join_url,
      htmlBody,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        zoomMeetingId: meeting.id,
        zoomJoinUrl: meeting.join_url,
        graphEventId,
      },
    });

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      zoomJoinUrl: meeting.join_url,
    });
  } catch (e) {
    if (zoomId) {
      await deleteZoomMeeting(zoomId);
    }
    if (reservedId) {
      await prisma.booking.delete({ where: { id: reservedId } }).catch(() => {
        /* ignore */
      });
    }
    if (e instanceof Error && (e as Error & { code?: string }).code === "SLOT_TAKEN") {
      return NextResponse.json(
        { error: "This time slot was just taken. Pick another time." },
        { status: 409 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Book failed:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
