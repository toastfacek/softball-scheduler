import type { EventStatus, EventType } from "@/db/schema";

export type CalendarEventInput = {
  id: string;
  type: EventType;
  status: EventStatus;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  updatedAt: Date;
};

export type BuildTeamCalendarArgs = {
  calName: string;
  timezone: string;
  events: CalendarEventInput[];
  appUrl: string;
  uidDomain: string;
};

export type InviteMethod = "REQUEST" | "CANCEL";

export type BuildEventInviteArgs = {
  event: CalendarEventInput;
  method: InviteMethod;
  appUrl: string;
  uidDomain: string;
  organizerEmail: string;
  organizerName?: string;
  attendeeEmail: string;
  attendeeName?: string;
};

const PRODID = "-//BGSL//Schedule//EN";

const DEFAULT_DURATION_MS: Record<EventType, number> = {
  PRACTICE: 90 * 60 * 1000,
  GAME: 120 * 60 * 1000,
  TEAM_EVENT: 120 * 60 * 1000,
};

export function buildTeamCalendar(args: BuildTeamCalendarArgs): string {
  const now = formatUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(args.calName)}`,
    `X-WR-TIMEZONE:${escapeText(args.timezone)}`,
  ];

  for (const event of args.events) {
    lines.push(
      ...buildVEvent(event, {
        appUrl: args.appUrl,
        uidDomain: args.uidDomain,
        dtstamp: now,
      }),
    );
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function buildEventInvite(args: BuildEventInviteArgs): string {
  const now = formatUtc(new Date());
  const organizer = buildIcalAddress("ORGANIZER", {
    email: args.organizerEmail,
    name: args.organizerName,
  });
  const attendee = buildIcalAddress("ATTENDEE", {
    email: args.attendeeEmail,
    name: args.attendeeName,
  });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${args.method}`,
  ];

  lines.push(
    ...buildVEvent(args.event, {
      appUrl: args.appUrl,
      uidDomain: args.uidDomain,
      dtstamp: now,
      method: args.method,
      organizerLine: organizer,
      attendeeLine: attendee,
    }),
  );

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

type BuildVEventCtx = {
  appUrl: string;
  uidDomain: string;
  dtstamp: string;
  method?: InviteMethod;
  organizerLine?: string;
  attendeeLine?: string;
};

function buildVEvent(event: CalendarEventInput, ctx: BuildVEventCtx): string[] {
  const start = event.startsAt;
  const end =
    event.endsAt ?? new Date(start.getTime() + DEFAULT_DURATION_MS[event.type]);
  const isCanceled =
    ctx.method === "CANCEL" || event.status === "CANCELED";
  const summary = isCanceled ? `CANCELED: ${event.title}` : event.title;
  const location = formatLocation(event);
  const lastModified = formatUtc(event.updatedAt);
  const sequence = Math.floor(event.updatedAt.getTime() / 1000);

  const descriptionParts: string[] = [];
  if (event.description) {
    descriptionParts.push(event.description);
  }
  descriptionParts.push(`RSVP: ${ctx.appUrl}/events/${event.id}`);
  const description = descriptionParts.join("\n\n");

  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.id}@${ctx.uidDomain}`,
    `DTSTAMP:${ctx.dtstamp}`,
    `LAST-MODIFIED:${lastModified}`,
    `SEQUENCE:${sequence}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `STATUS:${ctx.method === "CANCEL" || isCanceled ? "CANCELLED" : "CONFIRMED"}`,
  ];

  if (ctx.organizerLine) lines.push(ctx.organizerLine);
  if (ctx.attendeeLine) lines.push(ctx.attendeeLine);

  if (description) {
    lines.push(`DESCRIPTION:${escapeText(description)}`);
  }
  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }

  lines.push("END:VEVENT");
  return lines;
}

function buildIcalAddress(
  prop: "ORGANIZER" | "ATTENDEE",
  args: { email: string; name?: string },
): string {
  const safeEmail = args.email.trim();
  const params: string[] = [];
  if (args.name && args.name.trim()) {
    params.push(`CN="${args.name.replace(/"/g, "")}"`);
  }
  if (prop === "ATTENDEE") {
    // Standard params so Outlook/Gmail recognize this as a normal invite
    // recipient. RSVP=FALSE because we collect RSVPs via the in-app flow,
    // not via email replies.
    params.push("CUTYPE=INDIVIDUAL");
    params.push("ROLE=REQ-PARTICIPANT");
    params.push("PARTSTAT=NEEDS-ACTION");
    params.push("RSVP=FALSE");
  }
  const paramStr = params.length ? `;${params.join(";")}` : "";
  return `${prop}${paramStr}:mailto:${safeEmail}`;
}

function formatLocation(event: CalendarEventInput): string {
  const parts: string[] = [];
  if (event.venueName) parts.push(event.venueName);
  if (event.addressLine1) parts.push(event.addressLine1);
  if (event.addressLine2) parts.push(event.addressLine2);
  const cityState = [event.city, event.state].filter(Boolean).join(", ");
  const cityStateZip = [cityState, event.postalCode].filter(Boolean).join(" ");
  if (cityStateZip) parts.push(cityStateZip);
  return parts.join(", ");
}

function formatUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const segments: string[] = [];
  let offset = 0;
  let isFirst = true;
  while (offset < bytes.length) {
    const limit = isFirst ? 75 : 74;
    const end = Math.min(offset + limit, bytes.length);
    const safeEnd = trimToCharBoundary(bytes, offset, end);
    const chunk = bytes.subarray(offset, safeEnd).toString("utf8");
    segments.push(isFirst ? chunk : ` ${chunk}`);
    offset = safeEnd;
    isFirst = false;
  }
  return segments.join("\r\n");
}

function trimToCharBoundary(bytes: Buffer, start: number, end: number): number {
  if (end >= bytes.length) return end;
  let boundary = end;
  while (boundary > start && (bytes[boundary] & 0xc0) === 0x80) {
    boundary -= 1;
  }
  return boundary;
}
