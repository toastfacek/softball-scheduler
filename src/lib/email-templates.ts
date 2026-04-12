import { rsvpUrl, signRsvpToken } from "@/lib/rsvp-tokens";
import { markdownishToHtml } from "@/lib/utils";

type EventLike = {
  id: string;
  title: string;
  startsAt: Date;
  venueName?: string | null;
  city?: string | null;
};

/**
 * Build the per-recipient RSVP button block. Each call returns a fresh token
 * scoped to the given guardian + event, so every guardian in a blast receives
 * a unique URL.
 */
export function rsvpButtonsHtml(args: {
  guardianId: string;
  eventId: string;
}): string {
  const yesToken = signRsvpToken(args);
  const yesUrl = rsvpUrl(yesToken, "AVAILABLE");
  const maybeUrl = rsvpUrl(yesToken, "MAYBE");
  const noUrl = rsvpUrl(yesToken, "UNAVAILABLE");

  const btn = (href: string, bg: string, border: string, color: string, label: string) => `
<a href="${escape(href)}" style="display:inline-block;padding:12px 22px;margin:4px 6px 4px 0;border-radius:12px;background:${bg};border:1px solid ${border};color:${color};font-weight:700;font-size:14px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">${label}</a>
`;

  return `
<div style="margin:20px 0;">
  ${btn(yesUrl, "#e4f1e3", "#86c289", "#2a6b31", "Yes, they're in")}
  ${btn(maybeUrl, "#fbefcf", "#e0ba55", "#7a5a1b", "Maybe")}
  ${btn(noUrl, "#fce1dc", "#d97a68", "#8b2a1c", "Can't make it")}
</div>
<p style="margin:12px 0;font-size:12px;color:#6b6b6b;">Or <a href="${escape(yesUrl.split("?")[0])}" style="color:#c4531a;">open the full RSVP page</a> to add a note or change later.</p>
`.trim();
}

export function rsvpButtonsText(args: {
  guardianId: string;
  eventId: string;
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
  subjectPrefix?: string;
  bodyIntro: string;
}): { subject: string; body: string; html: string } {
  const { event, guardianId, guardianFirstName, bodyIntro } = args;
  const prefix = args.subjectPrefix ? `${args.subjectPrefix}: ` : "";
  const subject = `${prefix}${event.title}`;

  const textBody = [
    `Hi ${guardianFirstName},`,
    "",
    bodyIntro,
    "",
    rsvpButtonsText({ guardianId, eventId: event.id }),
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#2a2a2a;">
  <p style="font-size:15px;">Hi ${escape(guardianFirstName)},</p>
  <div style="font-size:15px;line-height:1.55;">${markdownishToHtml(bodyIntro)}</div>
  ${rsvpButtonsHtml({ guardianId, eventId: event.id })}
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
  <p style="font-size:12px;color:#8a8a8a;">You're receiving this from Beverly Girls Softball League. Links expire in 72 hours.</p>
</div>
`.trim();

  return { subject, body: textBody, html };
}

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
