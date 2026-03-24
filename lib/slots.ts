import { DateTime } from "luxon";

export type WeeklyRuleLike = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type IntervalUtc = { start: Date; end: Date };

/** Luxon weekday: 1=Mon … 7=Sun → 0=Sun … 6=Sat */
function toSchemaDayOfWeek(luxonWeekday: number): number {
  return luxonWeekday === 7 ? 0 : luxonWeekday;
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Mark busy intervals in epoch-ms for the window [windowStart, windowEnd). */
function toBlockedMs(
  intervals: IntervalUtc[],
  windowStart: number,
  windowEnd: number,
  bufferMs: number,
): [number, number][] {
  const blocks: [number, number][] = [];
  for (const iv of intervals) {
    const s = iv.start.getTime() - bufferMs;
    const e = iv.end.getTime() + bufferMs;
    const lo = Math.max(s, windowStart);
    const hi = Math.min(e, windowEnd);
    if (lo < hi) blocks.push([lo, hi]);
  }
  blocks.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of blocks) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

function isBlocked(
  slotStart: number,
  slotEnd: number,
  blocks: [number, number][],
): boolean {
  for (const [s, e] of blocks) {
    if (overlaps(slotStart, slotEnd, s, e)) return true;
  }
  return false;
}

export function computeAvailableSlots(params: {
  rangeStartUtc: Date;
  rangeEndUtc: Date;
  timezone: string;
  slotMinutes: number;
  bufferMinutes: number;
  rules: WeeklyRuleLike[];
  busyUtc: IntervalUtc[];
  bookingsUtc: IntervalUtc[];
}): IntervalUtc[] {
  const slotMs = params.slotMinutes * 60_000;
  const bufferMs = params.bufferMinutes * 60_000;
  const rangeStart = params.rangeStartUtc.getTime();
  const rangeEnd = params.rangeEndUtc.getTime();
  if (rangeEnd <= rangeStart || slotMs <= 0) return [];

  const busyBlocks = toBlockedMs(
    [...params.busyUtc, ...params.bookingsUtc],
    rangeStart,
    rangeEnd,
    bufferMs,
  );

  const zone = params.timezone;
  let cursor = DateTime.fromJSDate(params.rangeStartUtc, { zone: "utc" })
    .setZone(zone)
    .startOf("day");
  const endLuxon = DateTime.fromJSDate(params.rangeEndUtc, { zone: "utc" }).setZone(
    zone,
  );

  const results: IntervalUtc[] = [];

  while (cursor < endLuxon) {
    const dow = toSchemaDayOfWeek(cursor.weekday);
    const dayRules = params.rules.filter((r) => r.dayOfWeek === dow);
    for (const rule of dayRules) {
      if (rule.endMinute <= rule.startMinute) continue;
      for (
        let m = rule.startMinute;
        m + params.slotMinutes <= rule.endMinute;
        m += params.slotMinutes
      ) {
        const hour = Math.floor(m / 60);
        const minute = m % 60;
        const localStart = cursor.set({
          hour,
          minute,
          second: 0,
          millisecond: 0,
        });
        const localEnd = localStart.plus({ minutes: params.slotMinutes });
        const utcStart = localStart.toUTC();
        const utcEnd = localEnd.toUTC();
        const s = utcStart.toMillis();
        const e = utcEnd.toMillis();
        if (s < rangeStart || e > rangeEnd) continue;
        if (isBlocked(s, e, busyBlocks)) continue;
        results.push({ start: utcStart.toJSDate(), end: utcEnd.toJSDate() });
      }
    }
    cursor = cursor.plus({ days: 1 }).startOf("day");
  }

  results.sort((a, b) => a.start.getTime() - b.start.getTime());
  return results;
}
