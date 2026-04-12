import { db } from "@/db";
import { reminderDeliveries } from "@/db/schema";
import {
  getNonResponderGuardiansForEvent,
  getPendingReminderEvents,
} from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";
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

    const message = await sendTeamEmail({
      teamId: event.teamId,
      eventId: event.id,
      kind: "REMINDER",
      subject: `Please update softball availability for ${event.title}`,
      body: `A quick heads-up from BGSL.\n\n${formatEventDateTimeRange(
        event.startsAt,
        event.endsAt,
      )}\n${event.title}\n\nPlease update availability in the app so coaches can plan lineups and attendance. This reminder goes only to adults who still have at least one player without a response.`,
      recipients: guardians.map((guardian) => ({
        email: guardian.email,
        userId: guardian.userId,
      })),
      metadata: {
        reminderType: "NON_RESPONDER_24H",
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
