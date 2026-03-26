"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Settings = {
  timezone: string;
  slotMinutes: number;
  bufferMinutes: number;
};

type Rule = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type CalendarEvent = {
  id: string;
  source: "ics" | "booking";
  title: string;
  start: string;
  end: string;
  studentName?: string;
  studentEmail?: string;
  meetingUrl?: string;
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [busyFeedConfigured, setBusyFeedConfigured] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [tz, setTz] = useState("");
  const [slotM, setSlotM] = useState(30);
  const [bufM, setBufM] = useState(0);
  const [calendarStart, setCalendarStart] = useState(() => startOfDay(new Date()));

  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");

  const load = useCallback(async () => {
    setErr(null);
    const calendarEnd = new Date(calendarStart);
    calendarEnd.setDate(calendarEnd.getDate() + 7);

    try {
      const [sRes, rRes, cRes] = await Promise.all([
        fetch("/api/admin/settings", { credentials: "include" }),
        fetch("/api/admin/rules", { credentials: "include" }),
        fetch(
          `/api/admin/calendar?from=${encodeURIComponent(calendarStart.toISOString())}&to=${encodeURIComponent(calendarEnd.toISOString())}`,
          { credentials: "include" },
        ),
      ]);
      if (sRes.status === 401 || rRes.status === 401 || cRes.status === 401) {
        setAuthed(false);
        return;
      }
      if (!sRes.ok) {
        setErr(await sRes.text());
        return;
      }
      if (!rRes.ok) {
        setErr(await rRes.text());
        return;
      }
      if (!cRes.ok) {
        setErr(await cRes.text());
        return;
      }
      setAuthed(true);
      const sJson = (await sRes.json()) as {
        settings: Settings;
        microsoftConnected: boolean;
        busyFeedConfigured?: boolean;
      };
      const rJson = (await rRes.json()) as { rules: Rule[] };
      const cJson = (await cRes.json()) as {
        events: CalendarEvent[];
        busyFeedConfigured?: boolean;
      };
      setMicrosoftConnected(sJson.microsoftConnected);
      setBusyFeedConfigured(
        (sJson.busyFeedConfigured ?? cJson.busyFeedConfigured) === true,
      );
      setRules(rJson.rules);
      setCalendarEvents(cJson.events ?? []);
      setTz(sJson.settings.timezone);
      setSlotM(sJson.settings.slotMinutes);
      setBufM(sJson.settings.bufferMinutes);
    } catch {
      setErr("Failed to load");
    }
  }, [calendarStart]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot API bootstrap into local state
    void load();
  }, [load]);

  /** OAuth redirect params — read on client only to avoid hydration mismatches from useSearchParams. */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync URL query into UI after mount */
    const sp = new URLSearchParams(window.location.search);
    const msErr = sp.get("ms_error");
    const msOk = sp.get("ms_connected");
    if (msErr) setErr(safeDecode(msErr));
    if (msOk) setMsg("Microsoft account connected.");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setAuthError("Invalid password");
      return;
    }
    setPassword("");
    await load();
  }

  async function logout() {
    await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "include",
    });
    setAuthed(false);
    setRules([]);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        timezone: tz,
        slotMinutes: slotM,
        bufferMinutes: bufM,
      }),
    });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setMsg("Settings saved.");
    await load();
  }

  function toMinute(s: string): number {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/admin/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        dayOfWeek: newDay,
        startMinute: toMinute(newStart),
        endMinute: toMinute(newEnd),
      }),
    });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    await load();
  }

  async function delRule(id: string) {
    const res = await fetch(`/api/admin/rules?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    await load();
  }

  async function disconnectMs() {
    const res = await fetch("/api/admin/microsoft", {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setMsg("Microsoft disconnected.");
    await load();
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Home
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Admin</h1>
        <form onSubmit={login} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {authError && (
            <p className="text-sm text-red-600 dark:text-red-400">{authError}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Home
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="text-sm text-zinc-500 underline"
        >
          Sign out
        </button>
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Admin</h1>
      {msg && (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
          {msg}
        </p>
      )}
      {err && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          {err}
        </p>
      )}

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-medium">Busy Feed</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {busyFeedConfigured
            ? "Connected — ICS busy times are used for availability."
            : "Not connected — set OUTLOOK_ICS_URL to block slots when you are busy."}
        </p>
        {microsoftConnected ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Microsoft OAuth is still connected, but availability now uses the ICS feed.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/auth/microsoft/start"
            className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            Connect Microsoft (optional)
          </a>
          {microsoftConnected && (
            <button
              type="button"
              onClick={() => void disconnectMs()}
              className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              Disconnect
            </button>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Calendar (ICS + Bookings)</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setCalendarStart((d) => addDays(d, -7))
              }
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Prev 7d
            </button>
            <button
              type="button"
              onClick={() =>
                setCalendarStart((d) => addDays(d, 7))
              }
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Next 7d
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatRangeLabel(calendarStart)} ({tz || "UTC"})
        </p>
        {calendarEvents.length === 0 ? (
          <p className="mt-4 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700">
            No events in this range.
          </p>
        ) : (
          <WeekCalendar
            events={calendarEvents}
            weekStart={calendarStart}
            timeZone={tz || "UTC"}
          />
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Availability settings</h2>
        <form onSubmit={saveSettings} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Timezone (IANA)</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Slot length (minutes)</label>
            <input
              type="number"
              min={5}
              max={480}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600"
              value={slotM}
              onChange={(e) => setSlotM(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Buffer around bookings (minutes)
            </label>
            <input
              type="number"
              min={0}
              max={120}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600"
              value={bufM}
              onChange={(e) => setBufM(Number(e.target.value))}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save settings
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Weekly rules</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Day uses 0=Sunday … 6=Saturday. Minutes from midnight for start/end.
        </p>
        <ul className="mt-4 space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
            >
              <span>
                {DAYS[r.dayOfWeek] ?? r.dayOfWeek}{" "}
                {fmtMin(r.startMinute)}–{fmtMin(r.endMinute)}
              </span>
              <button
                type="button"
                onClick={() => void delRule(r.id)}
                className="text-red-600 dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addRule} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div>
            <label className="block text-xs text-zinc-500">Day</label>
            <select
              className="mt-1 rounded-md border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-600"
              value={newDay}
              onChange={(e) => setNewDay(Number(e.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500">From</label>
            <input
              type="time"
              className="mt-1 rounded-md border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-600"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">To</label>
            <input
              type="time"
              className="mt-1 rounded-md border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-600"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium dark:bg-zinc-800"
          >
            Add rule
          </button>
        </form>
      </section>
    </div>
  );
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}:${min.toString().padStart(2, "0")}`;
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

function formatRangeLabel(start: Date): string {
  const end = addDays(start, 6);
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

type CalendarSegment = {
  id: string;
  dayIndex: number;
  topPx: number;
  heightPx: number;
  source: "ics" | "booking";
  title: string;
  timeText: string;
  meetingUrl?: string;
};

function WeekCalendar({
  events,
  weekStart,
  timeZone,
}: {
  events: CalendarEvent[];
  weekStart: Date;
  timeZone: string;
}) {
  const hourPx = 44;
  const totalHeight = hourPx * 24;
  const start = DateTime.fromJSDate(weekStart, { zone: timeZone }).startOf("day");
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = start.plus({ days: i });
    return d.toFormat("ccc LLL d");
  });
  const segments = buildCalendarSegments(events, start, timeZone, hourPx);

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-zinc-200 dark:border-zinc-700">
          <div className="px-2 py-2 text-xs text-zinc-500">Time</div>
          {dayLabels.map((d) => (
            <div key={d} className="border-l border-zinc-200 px-2 py-2 text-xs font-medium dark:border-zinc-700">
              {d}
            </div>
          ))}
        </div>
        <div className="flex">
          <div className="relative w-14 shrink-0 border-r border-zinc-200 dark:border-zinc-700" style={{ height: totalHeight }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute left-0 w-full px-1 text-[10px] text-zinc-500"
                style={{ top: h * hourPx - 7 }}
              >
                {h.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>
          <div className="relative grid flex-1 grid-cols-7" style={{ height: totalHeight }}>
            {Array.from({ length: 7 }, (_, d) => (
              <div key={d} className="relative border-l border-zinc-200 dark:border-zinc-700">
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800"
                    style={{ top: h * hourPx }}
                  />
                ))}
                {segments
                  .filter((s) => s.dayIndex === d)
                  .map((s) => (
                    <div
                      key={s.id}
                      className={`absolute left-1 right-1 overflow-hidden rounded px-1.5 py-1 text-[10px] ${
                        s.source === "booking"
                          ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                      }`}
                      style={{ top: s.topPx, height: s.heightPx }}
                      title={`${s.title} (${s.timeText})`}
                    >
                      <div className="truncate font-medium">{s.title}</div>
                      <div className="truncate opacity-80">{s.timeText}</div>
                      {s.meetingUrl ? (
                        <a
                          href={s.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate underline"
                        >
                          link
                        </a>
                      ) : null}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildCalendarSegments(
  events: CalendarEvent[],
  weekStart: DateTime,
  zone: string,
  hourPx: number,
): CalendarSegment[] {
  const weekEnd = weekStart.plus({ days: 7 });
  const out: CalendarSegment[] = [];
  for (const ev of events) {
    const start = DateTime.fromISO(ev.start, { zone: "utc" }).setZone(zone);
    const end = DateTime.fromISO(ev.end, { zone: "utc" }).setZone(zone);
    if (!start.isValid || !end.isValid || end <= weekStart || start >= weekEnd) continue;
    const clippedStart = start < weekStart ? weekStart : start;
    const clippedEnd = end > weekEnd ? weekEnd : end;
    for (
      let day = clippedStart.startOf("day");
      day < clippedEnd;
      day = day.plus({ days: 1 })
    ) {
      const dayEnd = day.plus({ days: 1 });
      const segStart = clippedStart > day ? clippedStart : day;
      const segEnd = clippedEnd < dayEnd ? clippedEnd : dayEnd;
      if (segEnd <= segStart) continue;
      const dayIndex = Math.floor(day.diff(weekStart, "days").days);
      if (dayIndex < 0 || dayIndex > 6) continue;
      const startMin = segStart.hour * 60 + segStart.minute;
      const endMin = Math.max(startMin + 15, segEnd.hour * 60 + segEnd.minute);
      out.push({
        id: `${ev.id}-${dayIndex}-${startMin}`,
        dayIndex,
        topPx: (startMin / 60) * hourPx,
        heightPx: Math.max(16, ((endMin - startMin) / 60) * hourPx),
        source: ev.source,
        title: ev.title,
        timeText: `${segStart.toFormat("HH:mm")} - ${segEnd.toFormat("HH:mm")}`,
        meetingUrl: ev.meetingUrl,
      });
    }
  }
  return out;
}
