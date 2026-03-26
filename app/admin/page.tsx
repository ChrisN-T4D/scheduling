"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
          <ul className="mt-4 space-y-2">
            {calendarEvents.map((ev) => (
              <li
                key={ev.id}
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{ev.title}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      ev.source === "booking"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    }`}
                  >
                    {ev.source === "booking" ? "Booking" : "ICS busy"}
                  </span>
                </div>
                <div className="mt-1 text-zinc-600 dark:text-zinc-300">
                  {fmtDateTime(ev.start, tz)} - {fmtDateTime(ev.end, tz)}
                </div>
                {ev.studentName || ev.studentEmail ? (
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {ev.studentName ?? "Student"}
                    {ev.studentEmail ? ` (${ev.studentEmail})` : ""}
                  </div>
                ) : null}
                {ev.meetingUrl ? (
                  <a
                    href={ev.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 underline dark:text-blue-400"
                  >
                    Open meeting link
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
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

function fmtDateTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
