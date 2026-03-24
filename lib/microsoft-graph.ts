import { decryptString, encryptString } from "@/lib/crypto-secret";
import { getEnv } from "@/lib/env";
import { refreshMicrosoftToken } from "@/lib/microsoft-auth";
import { prisma } from "@/lib/db";

const PROVIDER = "microsoft";

export async function getMicrosoftGraphAccessToken(): Promise<string> {
  const env = getEnv();
  const row = await prisma.storedCredential.findUnique({
    where: { provider: PROVIDER },
  });
  if (!row) {
    throw new Error("Microsoft account is not connected");
  }
  const refresh = decryptString(row.refreshTokenEnc, env.TOKEN_ENCRYPTION_KEY);
  const now = Date.now();
  const skewMs = 60_000;
  if (
    row.accessTokenEnc &&
    row.expiresAt &&
    row.expiresAt.getTime() > now + skewMs
  ) {
    return decryptString(row.accessTokenEnc, env.TOKEN_ENCRYPTION_KEY);
  }
  const tokens = await refreshMicrosoftToken(refresh);
  const expiresAt = new Date(now + tokens.expires_in * 1000);
  const nextRefreshEnc = tokens.refresh_token
    ? encryptString(tokens.refresh_token, env.TOKEN_ENCRYPTION_KEY)
    : row.refreshTokenEnc;
  await prisma.storedCredential.update({
    where: { provider: PROVIDER },
    data: {
      accessTokenEnc: encryptString(tokens.access_token, env.TOKEN_ENCRYPTION_KEY),
      refreshTokenEnc: nextRefreshEnc,
      expiresAt,
    },
  });
  return tokens.access_token;
}

export type BusyInterval = { start: Date; end: Date };

export async function fetchCalendarBusy(params: {
  startUtc: Date;
  endUtc: Date;
}): Promise<BusyInterval[]> {
  const token = await getMicrosoftGraphAccessToken();
  const start = params.startUtc.toISOString();
  const end = params.endUtc.toISOString();
  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  url.searchParams.set("startDateTime", start);
  url.searchParams.set("endDateTime", end);
  url.searchParams.set("$select", "start,end,showAs,isCancelled");
  url.searchParams.set("$top", "500");
  const intervals: BusyInterval[] = [];
  let next: string | null = url.toString();
  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph calendarView ${res.status}: ${text}`);
    }
    const data = (await res.json()) as {
      value?: {
        start?: { dateTime: string; timeZone?: string };
        end?: { dateTime: string; timeZone?: string };
        showAs?: string;
        isCancelled?: boolean;
      }[];
      "@odata.nextLink"?: string;
    };
    for (const ev of data.value ?? []) {
      if (ev.isCancelled) continue;
      if (ev.showAs === "free" || ev.showAs === "workingElsewhere") continue;
      if (!ev.start?.dateTime || !ev.end?.dateTime) continue;
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;
      intervals.push({ start: s, end: e });
    }
    next = data["@odata.nextLink"] ?? null;
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

export async function createCalendarEventWithZoom(params: {
  subject: string;
  startUtc: Date;
  endUtc: Date;
  studentEmail: string;
  studentName: string;
  zoomJoinUrl: string;
  htmlBody: string;
}): Promise<string> {
  const token = await getMicrosoftGraphAccessToken();
  const body = {
    subject: params.subject,
    body: {
      contentType: "HTML",
      content: params.htmlBody,
    },
    start: {
      dateTime: params.startUtc.toISOString().replace(/\.\d{3}Z$/, "Z"),
      timeZone: "UTC",
    },
    end: {
      dateTime: params.endUtc.toISOString().replace(/\.\d{3}Z$/, "Z"),
      timeZone: "UTC",
    },
    location: {
      displayName: "Zoom",
    },
    attendees: [
      {
        emailAddress: {
          address: params.studentEmail,
          name: params.studentName,
        },
        type: "required",
      },
    ],
    allowNewTimeProposals: false,
    isOnlineMeeting: false,
  };
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph create event ${res.status}: ${text}`);
  }
  const created = (await res.json()) as { id?: string };
  if (!created.id) throw new Error("Graph create event: missing id");
  return created.id;
}

export async function isMicrosoftConnected(): Promise<boolean> {
  const row = await prisma.storedCredential.findUnique({
    where: { provider: PROVIDER },
  });
  return Boolean(row);
}
