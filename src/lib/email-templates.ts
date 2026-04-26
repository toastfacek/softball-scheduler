import { rsvpUrl, signRsvpToken } from "@/lib/rsvp-tokens";
import type { EventStatus, EventType } from "@/db/schema";
import { eventTypeLabel } from "@/lib/event-display";
import { formatEventDateTimeRange } from "@/lib/time";
import { escapeHtml, formatAddress, markdownishToHtml } from "@/lib/utils";

type EventLike = {
  id: string;
  title: string;
  type?: EventType;
  status?: EventStatus;
  startsAt: Date;
  endsAt?: Date | null;
  timezone?: string;
  description?: string | null;
  venueName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};

/**
 * Build the per-recipient RSVP button block. Each call returns a fresh token
 * scoped to the given guardian + event, so every guardian in a blast receives
 * a unique URL.
 */
export function rsvpButtonsHtml(args: {
  guardianId: string;
  eventId: string;
  messageId?: string;
}): string {
  const yesToken = signRsvpToken(args);
  const yesUrl = rsvpUrl(yesToken, "AVAILABLE");
  const maybeUrl = rsvpUrl(yesToken, "MAYBE");
  const noUrl = rsvpUrl(yesToken, "UNAVAILABLE");

  const btn = (href: string, bg: string, border: string, color: string, label: string) => `
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;margin:4px 6px 4px 0;border-radius:12px;background:${bg};border:1px solid ${border};color:${color};font-weight:700;font-size:14px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">${label}</a>
`;

  return `
<div style="margin:20px 0;">
  ${btn(yesUrl, "#e4f1e3", "#86c289", "#2a6b31", "Yes, they're in")}
  ${btn(maybeUrl, "#fbefcf", "#e0ba55", "#7a5a1b", "Maybe")}
  ${btn(noUrl, "#fce1dc", "#d97a68", "#8b2a1c", "Can't make it")}
</div>
<p style="margin:12px 0;font-size:12px;color:#6b6b6b;">Or <a href="${escapeHtml(yesUrl.split("?")[0])}" style="color:#c4531a;">open the full RSVP page</a> to add a note or change later.</p>
`.trim();
}

export function rsvpButtonsText(args: {
  guardianId: string;
  eventId: string;
  messageId?: string;
}): string {
  const token = signRsvpToken(args);
  const yesUrl = rsvpUrl(token, "AVAILABLE");
  const maybeUrl = rsvpUrl(token, "MAYBE");
  const noUrl = rsvpUrl(token, "UNAVAILABLE");

  return [
    "RSVP:",
    `  Yes: ${yesUrl}`,
    `  Maybe: ${maybeUrl}`,
    `  Can't make it: ${noUrl}`,
  ].join("\n");
}

/**
 * Render a personalized event email (HTML + plain text) with a per-guardian
 * RSVP button block. Returns { subject, body, html } suitable for the
 * `renderBody` hook on `sendTeamEmail`.
 */
export function renderEventRsvpEmail(args: {
  event: EventLike;
  guardianId: string;
  guardianFirstName: string;
  subject?: string;
  subjectPrefix?: string;
  bodyIntro: string;
  messageId?: string;
}): { subject: string; body: string; html: string } {
  const { event, guardianId, guardianFirstName, bodyIntro, messageId } = args;
  const prefix = args.subjectPrefix ? `${args.subjectPrefix}: ` : "";
  const subject = args.subject ?? `${prefix}${event.title}`;

  const textBody = [
    `Hi ${guardianFirstName},`,
    "",
    bodyIntro,
    "",
    renderEventDetailsText(event),
    "",
    rsvpButtonsText({ guardianId, eventId: event.id, messageId }),
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#2a2a2a;">
  <p style="font-size:15px;">Hi ${escapeHtml(guardianFirstName)},</p>
  <div style="font-size:15px;line-height:1.55;">${markdownishToHtml(bodyIntro)}</div>
  ${renderEventDetailsHtml(event)}
  ${rsvpButtonsHtml({ guardianId, eventId: event.id, messageId })}
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
  <p style="font-size:12px;color:#8a8a8a;">You're receiving this from Beverly Girls Softball League. Links expire in 72 hours.</p>
</div>
`.trim();

  return { subject, body: textBody, html };
}

export function renderEventDetailsText(event: EventLike): string {
  const rows = eventDetailRows(event);

  return [
    "Event details:",
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ].join("\n");
}

function renderEventDetailsHtml(event: EventLike): string {
  const rows = eventDetailRows(event);

  return `
<div style="margin:18px 0;padding:14px 16px;border:1px solid #e8ded6;border-radius:14px;background:#fff9f3;">
  <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#8a4b1f;">Event details</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.45;color:#2a2a2a;">
    <tbody>
      ${rows
        .map(
          (row) => `
      <tr>
        <td style="padding:5px 12px 5px 0;width:82px;color:#6b6b6b;font-weight:700;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:5px 0;vertical-align:top;">${markdownishToHtml(row.value)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>
</div>
`.trim();
}

function eventDetailRows(event: EventLike): Array<{ label: string; value: string }> {
  const typeAndStatus = [
    event.type ? eventTypeLabel(event.type) : null,
    event.status && event.status !== "SCHEDULED"
      ? titleCase(event.status)
      : null,
  ].filter(Boolean);
  const location = formatAddress([
    event.venueName,
    event.addressLine1,
    event.addressLine2,
    event.city,
    event.state,
    event.postalCode,
  ]);

  return [
    { label: "Event", value: event.title },
    typeAndStatus.length > 0
      ? { label: "Type", value: typeAndStatus.join(" · ") }
      : null,
    {
      label: "When",
      value: formatEventDateTimeRange(
        event.startsAt,
        event.endsAt,
        event.timezone,
      ),
    },
    location ? { label: "Where", value: location } : null,
    event.description?.trim()
      ? { label: "Notes", value: event.description.trim() }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
