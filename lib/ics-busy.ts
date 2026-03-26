import ICAL from "ical.js";

export type BusyInterval = { start: Date; end: Date };

export async function fetchBusyFromIcs(params: {
  icsUrl: string;
  startUtc: Date;
  endUtc: Date;
}): Promise<BusyInterval[]> {
  const res = await fetch(params.icsUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`ICS fetch failed ${res.status}`);
  }
  const icsText = await res.text();
  const jcal = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");
  const intervals: BusyInterval[] = [];

  for (const v of vevents) {
    const ev = new ICAL.Event(v);
    if (ev.isRecurring()) {
      const iter = ev.iterator();
      let next: ICAL.Time | null;
      while ((next = iter.next())) {
        const occStart = next.toJSDate();
        if (occStart >= params.endUtc) break;
        const details = ev.getOccurrenceDetails(next);
        const occEnd = details.endDate.toJSDate();
        if (occEnd <= params.startUtc) continue;
        intervals.push({ start: occStart, end: occEnd });
      }
      continue;
    }

    const start = ev.startDate.toJSDate();
    const end = ev.endDate.toJSDate();
    if (end <= params.startUtc || start >= params.endUtc) continue;
    intervals.push({ start, end });
  }

  return mergeIntervals(intervals);
}

function mergeIntervals(raw: BusyInterval[]): BusyInterval[] {
  if (raw.length === 0) return [];
  const sorted = [...raw].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: BusyInterval[] = [];
  let cur = { ...sorted[0]! };
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (n.start.getTime() <= cur.end.getTime()) {
      cur.end = n.end > cur.end ? n.end : cur.end;
    } else {
      out.push(cur);
      cur = { ...n };
    }
  }
  out.push(cur);
  return out;
}
