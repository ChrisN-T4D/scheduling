import { requireZoomConfig } from "@/lib/env";

type ZoomTokenResponse = {
  access_token: string;
  expires_in: number;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }
  const { accountId, clientId, clientSecret } = requireZoomConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: accountId,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoom token ${res.status}: ${text}`);
  }
  const data = (await res.json()) as ZoomTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

export type CreatedMeeting = {
  id: string;
  join_url: string;
  start_url: string;
};

export async function createZoomMeeting(params: {
  topic: string;
  startUtc: Date;
  durationMinutes: number;
  agenda?: string;
}): Promise<CreatedMeeting> {
  const token = await getAccessToken();
  const start_time = params.startUtc.toISOString().replace(/\.\d{3}Z$/, "Z");
  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: params.topic,
      type: 2,
      start_time,
      duration: Math.max(1, Math.ceil(params.durationMinutes)),
      timezone: "UTC",
      agenda: params.agenda,
      settings: {
        waiting_room: true,
        meeting_invitees: [],
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoom create meeting ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    id?: number | string;
    join_url?: string;
    start_url?: string;
  };
  if (data.id == null || !data.join_url) {
    throw new Error("Zoom create meeting: unexpected response");
  }
  return {
    id: String(data.id),
    join_url: data.join_url,
    start_url: data.start_url ?? data.join_url,
  };
}

export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    console.error(`Zoom delete meeting ${res.status}: ${text}`);
  }
}

