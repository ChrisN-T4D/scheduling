import { google } from "googleapis";
import { getEnv, requireGoogleCalendarConfig } from "@/lib/env";
import {
  getGoogleOAuth2ClientForCalendar,
  isGoogleOAuthConnected,
} from "@/lib/google-oauth-tokens";

function calendarIdForOAuth(): string {
  const id = getEnv().GOOGLE_CALENDAR_ID?.trim();
  return id && id.length > 0 ? id : "primary";
}

export async function createGoogleCalendarEvent(params: {
  summary: string;
  startUtc: Date;
  endUtc: Date;
  studentEmail: string;
  studentName: string;
  meetingUrl: string;
  notes?: string;
}): Promise<string> {
  const env = getEnv();
  const oauthConnected = await isGoogleOAuthConnected();

  const description = [
    `Student: ${params.studentName} <${params.studentEmail}>`,
    `Meeting link: ${params.meetingUrl}`,
    params.notes ? `Notes: ${params.notes}` : null,
    "Booked via scheduling app.",
  ]
    .filter(Boolean)
    .join("\n");

  if (oauthConnected) {
    if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
      throw new Error(
        "Google OAuth is connected but GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in the environment.",
      );
    }
    const auth = await getGoogleOAuth2ClientForCalendar();
    const calendar = google.calendar({ version: "v3", auth });
    const calId = calendarIdForOAuth();
    const res = await calendar.events.insert({
      calendarId: calId,
      requestBody: {
        summary: params.summary,
        description,
        location: params.meetingUrl,
        start: {
          dateTime: params.startUtc.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: params.endUtc.toISOString(),
          timeZone: "UTC",
        },
        attendees: [
          {
            email: "clneu@nwosu.edu",
            displayName: "Dr. Christopher Neu",
          },
          {
            email: params.studentEmail,
            displayName: params.studentName,
          },
        ],
      },
      sendUpdates: "all",
    });
    const id = res.data.id;
    if (!id) {
      throw new Error("Google Calendar create event: missing id");
    }
    return id;
  }

  const cfg = requireGoogleCalendarConfig();
  const auth = new google.auth.JWT({
    email: cfg.clientEmail,
    key: cfg.privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.insert({
    calendarId: cfg.calendarId,
    requestBody: {
      summary: params.summary,
      description,
      location: params.meetingUrl,
      start: {
        dateTime: params.startUtc.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: params.endUtc.toISOString(),
        timeZone: "UTC",
      },
      attendees: [
        {
          email: "clneu@nwosu.edu",
          displayName: "Dr. Christopher Neu",
        },
      ],
    },
  });

  const id = res.data.id;
  if (!id) {
    throw new Error("Google Calendar create event: missing id");
  }
  return id;
}
