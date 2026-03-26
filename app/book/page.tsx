"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Slot = { start: string; end: string };

function computeRange(): { from: string; to: string } {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 14);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function BookPage() {
  const [timezone, setTimezone] = useState("UTC");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [microsoftConnected, setMicrosoftConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);

  const [range, setRange] = useState<{ from: string; to: string } | null>(
    null,
  );

  useEffect(() => {
    setRange(computeRange());
  }, []);

  const load = useCallback(async () => {
    if (!range) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/availability?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      );
      const data = (await res.json()) as {
        error?: string;
        slots?: Slot[];
        timezone?: string;
        slotMinutes?: number;
        microsoftConnected?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to load availability");
        setSlots([]);
        return;
      }
      setSlots(data.slots ?? []);
      if (data.timezone) setTimezone(data.timezone);
      if (data.slotMinutes != null) setSlotMinutes(data.slotMinutes);
      setMicrosoftConnected(data.microsoftConnected !== false);
    } catch {
      setError("Network error");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (!range) return;
    void load();
  }, [range, load]);

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
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-xl font-semibold">You&apos;re booked</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Check your email for the calendar invite and event details.
        </p>
        {meetingUrl ? (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline dark:text-blue-400"
          >
            Open meeting room
          </a>
        ) : null}
        <div className="mt-8">
          <button
            type="button"
            onClick={() => {
              setIsDone(false);
              setMeetingUrl(null);
            }}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Book another
          </button>
        </div>
        <Link href="/" className="mt-6 block text-sm text-zinc-500">
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Book a session</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Times shown in your host&apos;s timezone ({timezone}).{" "}
        {slotMinutes}-minute slots.
      </p>
      {!microsoftConnected && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Microsoft calendar is not connected yet — shown times use your weekly
          rules only (no busy-time blocking).
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          {error}
        </p>
      )}
      <div className="mt-6">
        {!range || loading ? (
          <p className="text-sm text-zinc-500">Loading open times…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-zinc-500">No open slots in this range.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
            {slots.map((s) => (
              <li key={s.start}>
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selected?.start === s.start
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {formatSlot(s.start)} – {formatSlot(s.end)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input
            required
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            required
            type="email"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Notes (optional)</label>
          <textarea
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={!selected || submitting}
          className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? "Booking…" : "Confirm booking"}
        </button>
      </form>
    </div>
  );
}
