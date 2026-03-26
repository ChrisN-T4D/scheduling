import { google } from "googleapis";
import { getEnv, requireGoogleCalendarConfig } from "@/lib/env";
import {
  getGoogleOAuth2ClientForCalendar,
  isGoogleOAuthConnected,
} from "@/lib/google-oauth-tokens";

export type BusyInterval = { start: Date; end: Date };

function calendarId(): string {
  const env = getEnv();
  const id = env.GOOGLE_CALENDAR_ID?.trim();
  return id && id.length > 0 ? id : "primary";
}

export async function fetchBusyFromGoogle(params: {
  startUtc: Date;
  endUtc: Date;
}): Promise<BusyInterval[]> {
  const env = getEnv();

  // Prefer OAuth (user calendar) if connected; otherwise fall back to service account
  const useOAuth = await isGoogleOAuthConnected();

  const auth = useOAuth
    ? await getGoogleOAuth2ClientForCalendar()
    : new google.auth.JWT({
        email: requireGoogleCalendarConfig().clientEmail,
        key: requireGoogleCalendarConfig().privateKey,
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      });

  const calendar = google.calendar({ version: "v3", auth });
  const calId = calendarId();

  const intervals: BusyInterval[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId: calId,
      timeMin: params.startUtc.toISOString(),
      timeMax: params.endUtc.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
    });

    for (const ev of res.data.items ?? []) {
      if (ev.status === "cancelled") continue;
      const startStr = ev.start?.dateTime ?? ev.start?.date;
      const endStr = ev.end?.dateTime ?? ev.end?.date;
      if (!startStr || !endStr) continue;
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (end <= params.startUtc || start >= params.endUtc) continue;
      intervals.push({ start, end });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

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

