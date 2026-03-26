"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Slot = { start: string; end: string };
const DURATION_OPTIONS = [15, 30, 45, 60];

export default function BookPage() {
  const [timezone, setTimezone] = useState("UTC");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busyFeedConfigured, setBusyFeedConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfDay(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const range = {
      from: weekStart.toISOString(),
      to: addDays(weekStart, 7).toISOString(),
    };
    const requestedDuration = durationMinutes;
    try {
      const q = new URLSearchParams({
        from: range.from,
        to: range.to,
      });
      if (requestedDuration) q.set("slotMinutes", String(requestedDuration));
      const res = await fetch(
        `/api/availability?${q.toString()}`,
      );
      const data = (await res.json()) as {
        error?: string;
        slots?: Slot[];
        timezone?: string;
        slotMinutes?: number;
        busyFeedConfigured?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to load availability");
        setSlots([]);
        return;
      }
      setSlots(data.slots ?? []);
      if (data.timezone) setTimezone(data.timezone);
      if (data.slotMinutes != null) {
        setSlotMinutes(data.slotMinutes);
        if (durationMinutes == null) {
          setDurationMinutes(data.slotMinutes);
        }
      }
      setBusyFeedConfigured(data.busyFeedConfigured === true);
    } catch {
      setError("Network error");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart, durationMinutes]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatSlot = (iso: string) => {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  };
  const weekLabel = `${formatDayShort(weekStart)} - ${formatDayShort(addDays(weekStart, 6))}`;
  const hourlyRows = Array.from({ length: 24 }, (_, i) => i);
  const dayLabels = Array.from({ length: 7 }, (_, i) => formatDayLabel(addDays(weekStart, i), timezone));
  const slotSegments = buildSlotSegments(slots, weekStart, timezone, 44);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: selected.start,
          end: selected.end,
          durationMinutes: durationMinutes ?? undefined,
          studentName,
          studentEmail,
          notes: notes || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        meetingUrl?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Booking failed");
        return;
      }
      setIsDone(true);
      setMeetingUrl(data.meetingUrl ?? null);
      setSelected(null);
      setStudentName("");
      setStudentEmail("");
      setNotes("");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (isDone) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-[#c8102e]/30 bg-white p-6 shadow-sm dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#c8102e]">
            NWOSU Scheduling
          </p>
          <h1 className="mt-2 text-xl font-semibold text-[#c8102e]">
            You&apos;re booked
          </h1>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
          Check your email for the calendar invite and event details.
          </p>
          {meetingUrl ? (
            <a
              href={meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-medium text-white hover:bg-[#a30f27]"
            >
              Open meeting room
            </a>
          ) : null}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                setIsDone(false);
                setMeetingUrl(null);
              }}
              className="text-sm text-zinc-700 underline dark:text-zinc-300"
            >
              Book another
            </button>
          </div>
          <Link href="/" className="mt-6 block text-sm text-zinc-600 hover:underline">
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-2xl border border-[#c8102e]/30 bg-white p-6 shadow-sm dark:bg-zinc-950">
        <Link href="/" className="text-sm text-zinc-600 hover:underline">
          ← Home
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#c8102e]">
          Northwestern Oklahoma State University
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#c8102e]">Book a session</h1>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          Times shown in your host&apos;s timezone ({timezone}).{" "}
          {(durationMinutes ?? slotMinutes)}-minute slots.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Prev 7 days
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Next 7 days
            </button>
          </div>
          <label className="text-sm">
            Meeting length:
            <select
              className="ml-2 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-600"
              value={durationMinutes ?? slotMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <span className="text-sm text-zinc-600 dark:text-zinc-300">{weekLabel}</span>
        </div>
        {!busyFeedConfigured && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Busy calendar feed is not configured — shown times use your weekly
            rules only.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            {error}
          </p>
        )}
        <div className="mt-6">
        {loading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading open times…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No open slots in this range.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-zinc-200 dark:border-zinc-700">
                <div className="px-2 py-2 text-xs text-zinc-500">Time</div>
                {dayLabels.map((d) => (
                  <div
                    key={d}
                    className="border-l border-zinc-200 px-2 py-2 text-xs font-medium dark:border-zinc-700"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="flex">
                <div
                  className="relative w-14 shrink-0 border-r border-zinc-200 dark:border-zinc-700"
                  style={{ height: 44 * 24 }}
                >
                  {hourlyRows.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 w-full px-1 text-[10px] text-zinc-500"
                      style={{ top: h * 44 - 7 }}
                    >
                      {h.toString().padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                <div className="relative grid flex-1 grid-cols-7" style={{ height: 44 * 24 }}>
                  {Array.from({ length: 7 }, (_, d) => (
                    <div key={d} className="relative border-l border-zinc-200 dark:border-zinc-700">
                      {hourlyRows.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800"
                          style={{ top: h * 44 }}
                        />
                      ))}
                      {slotSegments
                        .filter((s) => s.dayIndex === d)
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelected(s.slot)}
                            className={`absolute left-1 right-1 overflow-hidden rounded px-1.5 py-1 text-left text-[10px] ${
                              selected?.start === s.slot.start
                                ? "bg-[#c8102e] text-white"
                                : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                            }`}
                            style={{ top: s.topPx, height: s.heightPx }}
                            title={`${formatSlot(s.slot.start)} - ${formatSlot(s.slot.end)}`}
                          >
                            <div className="truncate font-medium">{s.timeText}</div>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-[#c8102e] focus:outline-none dark:border-zinc-600"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              required
              type="email"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-[#c8102e] focus:outline-none dark:border-zinc-600"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-[#c8102e] focus:outline-none dark:border-zinc-600"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!selected || submitting}
            className="w-full rounded-lg bg-[#c8102e] py-3 text-sm font-medium text-white hover:bg-[#a30f27] disabled:opacity-50"
          >
            {submitting ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      </div>
    </div>
  );
}

type SlotSegment = {
  id: string;
  dayIndex: number;
  topPx: number;
  heightPx: number;
  timeText: string;
  slot: Slot;
};

function buildSlotSegments(
  slots: Slot[],
  weekStart: Date,
  zone: string,
  hourPx: number,
): SlotSegment[] {
  const start = new Date(weekStart);
  const end = addDays(start, 7);
  const out: SlotSegment[] = [];
  for (const slot of slots) {
    const s = toZonedDate(slot.start, zone);
    const e = toZonedDate(slot.end, zone);
    if (!s || !e || e <= start || s >= end) continue;
    const dayIndex = dayDiff(start, s);
    if (dayIndex < 0 || dayIndex > 6) continue;
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = e.getHours() * 60 + e.getMinutes();
    out.push({
      id: `${slot.start}-${dayIndex}`,
      dayIndex,
      topPx: (startMin / 60) * hourPx,
      heightPx: Math.max(16, ((endMin - startMin) / 60) * hourPx),
      timeText: `${hhmm(s)} - ${hhmm(e)}`,
      slot,
    });
  }
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function dayDiff(a: Date, b: Date): number {
  const aa = startOfDay(a).getTime();
  const bb = startOfDay(b).getTime();
  return Math.floor((bb - aa) / 86_400_000);
}

function formatDayLabel(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatDayShort(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
}

function hhmm(d: Date): string {
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function toZonedDate(iso: string, timeZone: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const y = Number(parts.year);
  const m = Number(parts.month) - 1;
  const day = Number(parts.day);
  const h = Number(parts.hour);
  const min = Number(parts.minute);
  const s = Number(parts.second);
  return new Date(y, m, day, h, min, s);
}
