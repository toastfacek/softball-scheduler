import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { adultUsers, events } from "@/db/schema";
import { env } from "@/lib/env";
import { buildEventInvite, type InviteMethod } from "@/lib/ical";
import { listEventUpdateRecipients } from "@/lib/data";
import { sendTeamEmail } from "@/lib/notifications";

type SendEventCalendarUpdateInput = {
  teamId: string;
  eventId: string;
  method: InviteMethod;
  createdByUserId?: string | null;
  /**
   * Action verb for the subject and body. "Added" for new events, "Updated"
   * for edits, "Canceled" for cancels. Falls back based on `method` if omitted.
   */
  action?: "Added" | "Updated" | "Canceled";
  /**
   * Optional one-line note prepended to the email body. Useful for migration
   * messaging like "If you previously subscribed to the calendar URL, please
   * remove it to avoid duplicates."
   */
  bodyNote?: string;
};

export async function sendEventCalendarUpdate(
  input: SendEventCalendarUpdateInput,
) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, input.eventId),
  });
  if (!event || event.teamId !== input.teamId) return null;

  const recipients = await listEventUpdateRecipients(
    input.teamId,
    input.eventId,
    "ALL_GUARDIANS",
  );
  if (recipients.length === 0) return null;

  const recipientUserIds = recipients
    .map((r) => r.userId)
    .filter((id): id is string => Boolean(id));
  const adultRows =
    recipientUserIds.length > 0
      ? await db
          .select({ id: adultUsers.id, name: adultUsers.name })
          .from(adultUsers)
          .where(inArray(adultUsers.id, recipientUserIds))
      : [];
  const adultNamesById = new Map(
    adultRows.map((row) => [row.id, (row.name ?? "").trim()]),
  );

  const action =
    input.action ?? (input.method === "CANCEL" ? "Canceled" : "Updated");
  const subject = `${action}: ${event.title}`;

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const uidDomain = (() => {
    try {
      return new URL(appUrl).host || "bgsl";
    } catch {
      return "bgsl";
    }
  })();

  const organizerEmail = extractEmail(env.AUTH_RESEND_FROM);
  const organizerName = env.AUTH_RESEND_FROM_NAME;

  const eventLink = `${appUrl}/events/${event.id}`;
  const bodyLines: string[] = [];
  if (input.bodyNote) {
    bodyLines.push(input.bodyNote, "");
  }
  if (input.method === "CANCEL") {
    bodyLines.push(`This event has been canceled: ${event.title}.`);
  } else {
    bodyLines.push(`${action} event: ${event.title}.`);
    bodyLines.push(
      "Your calendar should pick up the change automatically from this email.",
    );
  }
  bodyLines.push("", `Details: ${eventLink}`);
  const body = bodyLines.join("\n");

  return sendTeamEmail({
    teamId: input.teamId,
    createdByUserId: input.createdByUserId ?? null,
    eventId: event.id,
    kind: "EVENT_INVITE",
    subject,
    body,
    recipients: recipients.map((r) => ({
      email: r.email,
      userId: r.userId,
      playerId:
        "playerId" in r && typeof r.playerId === "string" ? r.playerId : null,
    })),
    metadata: {
      method: input.method,
      action,
    },
    renderBody: (recipient) => {
      const attendeeName = recipient.userId
        ? adultNamesById.get(recipient.userId) ?? undefined
        : undefined;
      const ics = buildEventInvite({
        event: {
          id: event.id,
          type: event.type,
          status: event.status,
          title: event.title,
          description: event.description,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venueName: event.venueName,
          addressLine1: event.addressLine1,
          addressLine2: null,
          city: event.city,
          state: event.state,
          postalCode: event.postalCode,
          updatedAt: event.updatedAt,
        },
        method: input.method,
        appUrl,
        uidDomain,
        organizerEmail,
        organizerName,
        attendeeEmail: recipient.email,
        attendeeName: attendeeName || undefined,
      });
      return {
        attachments: [
          {
            filename: "event.ics",
            content: ics,
            // RFC 5546 / 6047 — METHOD parameter on the calendar MIME type
            // is what tells Gmail/Outlook this is an invite, not a feed.
            contentType: `text/calendar; charset=utf-8; method=${input.method}`,
          },
        ],
      };
    },
  });
}

function extractEmail(fromAddress: string): string {
  const match = fromAddress.match(/<([^>]+)>/);
  return (match?.[1] ?? fromAddress).trim();
}
