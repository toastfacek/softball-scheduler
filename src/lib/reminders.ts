import { db } from "@/db";
import { reminderDeliveries } from "@/db/schema";
import {
  getNonResponderGuardiansForEvent,
  getPendingReminderEvents,
} from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";
import { renderEventRsvpEmail } from "@/lib/email-templates";
import { sendTeamEmail } from "@/lib/notifications";
import { sendTeamText } from "@/lib/text-notifications";
import { renderEventRsvpText } from "@/lib/text-templates";

type Guardian = Awaited<ReturnType<typeof getNonResponderGuardiansForEvent>>[number];

export async function runReminderSweep(now = new Date()) {
  const pendingEvents = await getPendingReminderEvents(now);
  const results: {
    eventId: string;
    sent: number;
    skipped: number;
  }[] = [];

  for (const event of pendingEvents) {
    const guardians = await getNonResponderGuardiansForEvent(
      event.id,
      event.teamId,
    );

    if (guardians.length === 0) {
      results.push({ eventId: event.id, sent: 0, skipped: 0 });
      continue;
    }

    const dateLine = formatEventDateTimeRange(event.startsAt, event.endsAt);
    const textGuardians = guardians.filter(prefersText);
    const emailGuardians = guardians.filter((g) => !prefersText(g));

    let sent = 0;

    if (textGuardians.length > 0) {
      const guardianById = new Map(textGuardians.map((g) => [g.userId, g]));
      const message = await sendTeamText({
        teamId: event.teamId,
        eventId: event.id,
        kind: "REMINDER",
        body: `Please RSVP for ${event.title}`,
        recipients: textGuardians.map((g) => ({
          userId: g.userId,
          phone: g.phone,
        })),
        metadata: { reminderType: "NON_RESPONDER_24H_SMS" },
        renderBody: ({ userId }) => {
          const guardian = userId ? guardianById.get(userId) : null;
          if (!guardian) return {};
          return {
            body: renderEventRsvpText({
              event,
              guardianId: guardian.userId,
              players: guardian.players,
              dateLine,
            }),
          };
        },
      });

      // PENDING = Twilio accepted the message (delivery confirmation arrives
      // asynchronously via the /api/sms/status webhook which upgrades the DB
      // row). PENDING counts as "attempted" for idempotency so the next cron
      // tick doesn't re-queue.
      const sentTexts =
        message?.sendResults.filter(
          (r) => r.deliveryStatus === "PENDING",
        ) ?? [];

      if (sentTexts.length > 0) {
        await db.insert(reminderDeliveries).values(
          sentTexts
            .filter((r) => r.recipient.userId)
            .map((r) => ({
              eventId: event.id,
              userId: r.recipient.userId!,
              textRecipientId: r.textRecipientId,
              reminderType: "NON_RESPONDER_24H_SMS" as const,
            })),
        );
      }

      sent += sentTexts.length;
    }

    if (emailGuardians.length > 0) {
      const guardianById = new Map(emailGuardians.map((g) => [g.userId, g]));
      const message = await sendTeamEmail({
        teamId: event.teamId,
        eventId: event.id,
        kind: "REMINDER",
        subject: `Please RSVP for ${event.title}`,
        body: `A quick heads-up from BGSL.\n\n${dateLine}\n${event.title}\n\nPlease RSVP so coaches can plan lineups and attendance.`,
        recipients: emailGuardians.map((g) => ({
          email: g.email,
          userId: g.userId,
        })),
        metadata: { reminderType: "NON_RESPONDER_24H" },
        renderBody: (recipient) => {
          if (!recipient.userId) return {};
          const guardian = guardianById.get(recipient.userId);
          const firstName = (guardian?.name ?? "").split(" ")[0] || "there";
          const players = guardian?.players ?? [];
          const playerLine =
            players.length > 0
              ? `We haven't heard back about ${players.join(" & ")} yet.`
              : "We haven't heard back about your player yet.";
          const intro = [
            playerLine,
            "",
            `**${event.title}** — ${dateLine}`,
            "",
            "Tap below to RSVP:",
          ].join("\n");
          return renderEventRsvpEmail({
            event,
            guardianId: recipient.userId,
            guardianFirstName: firstName,
            subjectPrefix: "Reminder",
            bodyIntro: intro,
          });
        },
      });

      const sentEmails =
        message?.sendResults.filter((r) => r.deliveryStatus === "SENT") ?? [];

      if (sentEmails.length > 0) {
        await db.insert(reminderDeliveries).values(
          sentEmails
            .filter((r) => r.recipient.userId)
            .map((r) => ({
              eventId: event.id,
              userId: r.recipient.userId!,
              reminderType: "NON_RESPONDER_24H" as const,
            })),
        );
      }

      sent += sentEmails.length;
    }

    results.push({
      eventId: event.id,
      sent,
      skipped: guardians.length - sent,
    });
  }

  return results;
}

function prefersText(guardian: Guardian) {
  return Boolean(guardian.textOptIn && guardian.phone);
}
