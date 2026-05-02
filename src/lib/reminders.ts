import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { reminderDeliveries } from "@/db/schema";
import {
  getNonResponderGuardiansForEvent,
  getPendingReminderEvents,
} from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";
import {
  renderEventDetailsText,
  renderEventRsvpEmail,
} from "@/lib/email-templates";
import { isTwilioConfigured } from "@/lib/env";
import { sendTeamEmail } from "@/lib/notifications";
import { sendTeamText } from "@/lib/text-notifications";
import { renderEventRsvpText } from "@/lib/text-templates";

type Guardian = Awaited<ReturnType<typeof getNonResponderGuardiansForEvent>>[number];
type ReminderType = "NON_RESPONDER_24H" | "NON_RESPONDER_24H_SMS";

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
    const textRemindersEnabled = isTwilioConfigured();
    const textGuardians = textRemindersEnabled
      ? guardians.filter(prefersText)
      : [];
    const emailGuardians = textRemindersEnabled
      ? guardians.filter((g) => !prefersText(g))
      : guardians;

    let sent = 0;

    if (textGuardians.length > 0) {
      const claimedTextReminders = await claimReminderDeliveries(
        event.id,
        textGuardians,
        "NON_RESPONDER_24H_SMS",
      );
      const textReminderByUserId = new Map(
        claimedTextReminders.map((r) => [r.guardian.userId, r]),
      );
      const claimedTextGuardians = claimedTextReminders.map((r) => r.guardian);
      const guardianById = new Map(
        claimedTextGuardians.map((g) => [g.userId, g]),
      );
      const message =
        claimedTextGuardians.length > 0
          ? await sendTeamText({
              teamId: event.teamId,
              eventId: event.id,
              kind: "REMINDER",
              body: `Please RSVP for ${event.title}`,
              recipients: claimedTextGuardians.map((g) => ({
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
            }).catch(async (error) => {
              await releaseFailedReminderClaims(claimedTextReminders, new Set());
              throw error;
            })
          : null;

      // PENDING = Twilio accepted the message (delivery confirmation arrives
      // asynchronously via the /api/sms/status webhook which upgrades the DB
      // row). PENDING counts as "attempted" for idempotency so the next cron
      // tick doesn't re-queue.
      const sentTexts =
        message?.sendResults.filter(
          (r) => r.deliveryStatus === "PENDING",
        ) ?? [];

      const sentTextUserIds = new Set(
        sentTexts
          .map((result) => result.recipient.userId)
          .filter((id): id is string => Boolean(id)),
      );

      try {
        if (sentTexts.length > 0) {
          await Promise.all(
            sentTexts.map((result) => {
              const reminder = result.recipient.userId
                ? textReminderByUserId.get(result.recipient.userId)
                : null;
              if (!reminder) return Promise.resolve();

              return db
                .update(reminderDeliveries)
                .set({ textRecipientId: result.textRecipientId })
                .where(eq(reminderDeliveries.id, reminder.id));
            }),
          );
        }
      } finally {
        await releaseFailedReminderClaims(
          claimedTextReminders,
          sentTextUserIds,
        );
      }

      sent += sentTexts.length;
    }

    if (emailGuardians.length > 0) {
      const claimedEmailReminders = await claimReminderDeliveries(
        event.id,
        emailGuardians,
        "NON_RESPONDER_24H",
      );
      const claimedEmailGuardians = claimedEmailReminders.map((r) => r.guardian);
      const guardianById = new Map(
        claimedEmailGuardians.map((g) => [g.userId, g]),
      );
      const message =
        claimedEmailGuardians.length > 0
          ? await sendTeamEmail({
              teamId: event.teamId,
              eventId: event.id,
              kind: "REMINDER",
              subject: `Please RSVP for ${event.title}`,
              body: [
                "A quick heads-up from BGSL.",
                "",
                renderEventDetailsText(event),
                "",
                "Please RSVP so coaches can plan lineups and attendance.",
              ].join("\n"),
              recipients: claimedEmailGuardians.map((g) => ({
                email: g.email,
                userId: g.userId,
              })),
              metadata: { reminderType: "NON_RESPONDER_24H" },
              renderBody: (recipient) => {
                if (!recipient.userId) return {};
                const guardian = guardianById.get(recipient.userId);
                const firstName =
                  (guardian?.name ?? "").split(" ")[0] || "there";
                const players = guardian?.players ?? [];
                const playerLine =
                  players.length > 0
                    ? `We haven't heard back about ${players.join(" & ")} yet.`
                    : "We haven't heard back about your player yet.";
                const intro = [
                  playerLine,
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
            }).catch(async (error) => {
              await releaseFailedReminderClaims(claimedEmailReminders, new Set());
              throw error;
            })
          : null;

      const sentEmails =
        message?.sendResults.filter((r) => r.deliveryStatus === "SENT") ?? [];

      await releaseFailedReminderClaims(
        claimedEmailReminders,
        new Set(
          sentEmails
            .map((result) => result.recipient.userId)
            .filter((id): id is string => Boolean(id)),
        ),
      );

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

async function claimReminderDeliveries(
  eventId: string,
  guardians: Guardian[],
  reminderType: ReminderType,
) {
  if (guardians.length === 0) return [];

  const claimedRows = await db
    .insert(reminderDeliveries)
    .values(
      guardians.map((guardian) => ({
        eventId,
        userId: guardian.userId,
        reminderType,
      })),
    )
    .onConflictDoNothing()
    .returning({
      id: reminderDeliveries.id,
      userId: reminderDeliveries.userId,
    });

  const guardianByUserId = new Map(
    guardians.map((guardian) => [guardian.userId, guardian]),
  );

  return claimedRows
    .map((row) => {
      const guardian = guardianByUserId.get(row.userId);
      return guardian ? { ...row, guardian } : null;
    })
    .filter((row): row is { id: string; userId: string; guardian: Guardian } =>
      Boolean(row),
    );
}

async function releaseFailedReminderClaims(
  claimedReminders: { id: string; userId: string }[],
  successfulUserIds: Set<string>,
) {
  const failedReminderIds = claimedReminders
    .filter((reminder) => !successfulUserIds.has(reminder.userId))
    .map((reminder) => reminder.id);

  if (failedReminderIds.length === 0) return;

  await db
    .delete(reminderDeliveries)
    .where(inArray(reminderDeliveries.id, failedReminderIds));
}
