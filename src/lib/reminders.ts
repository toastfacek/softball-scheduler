import { db } from "@/db";
import { reminderDeliveries } from "@/db/schema";
import {
  getNonResponderGuardiansForEvent,
  getPendingReminderEvents,
} from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";
import { renderEventRsvpEmail } from "@/lib/email-templates";
import { sendTeamEmail } from "@/lib/notifications";

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
      results.push({
        eventId: event.id,
        sent: 0,
        skipped: 0,
      });
      continue;
    }

    const guardianById = new Map(guardians.map((g) => [g.userId, g]));
    const dateLine = formatEventDateTimeRange(event.startsAt, event.endsAt);

    const message = await sendTeamEmail({
      teamId: event.teamId,
      eventId: event.id,
      kind: "REMINDER",
      subject: `Please RSVP for ${event.title}`,
      body: `A quick heads-up from BGSL.\n\n${dateLine}\n${event.title}\n\nPlease RSVP so coaches can plan lineups and attendance.`,
      recipients: guardians.map((guardian) => ({
        email: guardian.email,
        userId: guardian.userId,
      })),
      metadata: {
        reminderType: "NON_RESPONDER_24H",
      },
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

    const sentRecipients =
      message?.sendResults.filter((result) => result.deliveryStatus === "SENT") ??
      [];

    if (sentRecipients.length > 0) {
      await db.insert(reminderDeliveries).values(
        sentRecipients.map((result) => ({
          eventId: event.id,
          userId: result.recipient.userId ?? "",
          reminderType: "NON_RESPONDER_24H" as const,
        })),
      );
    }

    results.push({
      eventId: event.id,
      sent: sentRecipients.length,
      skipped: guardians.length - sentRecipients.length,
    });
  }

  return results;
}
