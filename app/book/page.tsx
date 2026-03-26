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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [monthStart, setMonthStart] = useState<Date>(() => startOfMonth(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const range = getMonthRange(monthStart);
    const requestedDuration = durationMinutes;
    try {
      const q = new URLSearchParams({
        from: range.from,
        to: range.to,
      });
      if (requestedDuration) q.set("slotMinutes", String(requestedDuration));
      const res = await fetch(`/api/availability?${q.toString()}`);
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
        if (durationMinutes == null) setDurationMinutes(data.slotMinutes);
      }
      setBusyFeedConfigured(data.busyFeedConfigured === true);
    } catch {
      setError("Network error");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [monthStart, durationMinutes]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(monthStart);
  const slotsByDate = groupSlotsByDate(slots, timezone);
  const monthCells = buildMonthCells(monthStart);
  const selectedDateSlots = selectedDateKey ? slotsByDate[selectedDateKey] ?? [] : [];

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
            Check your email for the meeting invite and event details.
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
        <h1 className="mt-1 text-2xl font-semibold text-[#c8102e]">Book a meeting</h1>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          Times shown in your host&apos;s timezone ({timezone}).{" "}
          {(durationMinutes ?? slotMinutes)}-minute slots.
        </p>

        <div className="mt-4">
          <label className="text-sm">
            Meeting length:
            <select
              className="ml-2 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
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
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setMonthStart((d) => addMonths(d, -1));
                setSelectedDateKey(null);
                setSelected(null);
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Prev month
            </button>
            <h2 className="text-center text-2xl font-semibold text-[#c8102e]">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={() => {
                setMonthStart((d) => addMonths(d, 1));
                setSelectedDateKey(null);
                setSelected(null);
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Next month
            </button>
          </div>
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
          {slots.length === 0 && loading ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading open times…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">No open slots in this range.</p>
          ) : (
            <>
              {loading ? (
                <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Updating availability…
                </p>
              ) : null}
              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900/40">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="px-2 py-2 text-center text-zinc-600 dark:text-zinc-300">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 border-l border-zinc-100 dark:border-zinc-800">
                  {monthCells.map((cell, idx) => {
                    const key = formatDateKey(cell, timezone);
                    const daySlots = slotsByDate[key] ?? [];
                    const isSelected = selectedDateKey === key;
                    const inMonth = cell.getMonth() === monthStart.getMonth();
                    return (
                      <button
                        type="button"
                        key={`${key}-${idx}`}
                        onClick={() => {
                          setSelectedDateKey(key);
                          setSelected(null);
                        }}
                        className={`min-h-24 border-r border-t border-zinc-100 p-2 text-left dark:border-zinc-800 ${
                          isSelected ? "bg-[#c8102e]/10" : ""
                        }`}
                      >
                        <span
                          className={`text-sm font-medium ${inMonth ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`}
                        >
                          {cell.getDate()}
                        </span>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Array.from({ length: Math.min(daySlots.length, 4) }, (_, i) => (
                            <span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-[#c8102e]"
                              title={`${daySlots.length} available`}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {selectedDateKey
                    ? `Available times for ${formatDateKeyHuman(selectedDateKey, timezone)}`
                    : "Select a date to view available meeting times"}
                </p>
                {selectedDateKey ? (
                  selectedDateSlots.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {selectedDateSlots.map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => setSelected(s)}
                          className={`rounded-md px-3 py-2 text-left text-sm ${
                            selected?.start === s.start
                              ? "bg-[#c8102e] text-white"
                              : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {formatTime12(s.start, timezone)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">No times available on this date.</p>
                  )
                ) : null}
              </div>
            </>
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

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfMonth(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(1);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  out.setDate(1);
  return startOfDay(out);
}

function getMonthRange(d: Date): { from: string; to: string } {
  const from = startOfMonth(d);
  const to = addMonths(from, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildMonthCells(monthStart: Date): Date[] {
  const first = startOfMonth(monthStart);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function groupSlotsByDate(slots: Slot[], timeZone: string): Record<string, Slot[]> {
  const out: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const d = toZonedDate(slot.start, timeZone);
    if (!d) continue;
    const key = formatDateKey(d, timeZone);
    if (!out[key]) out[key] = [];
    out[key]!.push(slot);
  }
  for (const key of Object.keys(out)) {
    out[key]!.sort((a, b) => a.start.localeCompare(b.start));
  }
  return out;
}

function formatDateKey(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDateKeyHuman(key: string, timeZone: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

function formatTime12(iso: string, timeZone: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
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
