import { google } from "googleapis";
import { requireGoogleCalendarConfig } from "@/lib/env";

export async function createGoogleCalendarEvent(params: {
  summary: string;
  startUtc: Date;
  endUtc: Date;
  studentEmail: string;
  studentName: string;
  meetingUrl: string;
  notes?: string;
}): Promise<string> {
  const cfg = requireGoogleCalendarConfig();
  const auth = new google.auth.JWT({
    email: cfg.clientEmail,
    key: cfg.privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  const description = [
    `Student: ${params.studentName} <${params.studentEmail}>`,
    `Meeting link: ${params.meetingUrl}`,
    params.notes ? `Notes: ${params.notes}` : null,
    "Booked via scheduling app.",
  ]
    .filter(Boolean)
    .join("\n");

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
