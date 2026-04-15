import { rsvpUrl, signRsvpToken } from "@/lib/rsvp-tokens";
import {
  signUnsubscribeToken,
  textsOffUrl,
} from "@/lib/unsubscribe-tokens";

type EventLike = {
  id: string;
  title: string;
};

export function renderEventRsvpText(args: {
  event: EventLike;
  guardianId: string;
  players: string[];
  dateLine: string;
}): string {
  const token = signRsvpToken({
    guardianId: args.guardianId,
    eventId: args.event.id,
  });
  const link = rsvpUrl(token);
  const unsubscribe = textsOffUrl(
    signUnsubscribeToken({ userId: args.guardianId }),
  );

  // TODO (you): write the iMessage body copy.
  //
  // Keep it short (ideally under 320 chars). Variables available:
  //   args.event.title           e.g. "Game vs. Manchester"
  //   args.dateLine              e.g. "Sat Apr 18, 10:00–11:30am"
  //   args.players               e.g. ["Sarah", "Emma"] — 0+ names
  //   link                       RSVP URL (already signed, 72h expiry)
  //   unsubscribe                one-tap opt-out URL
  //
  // Required: must include `link` and `unsubscribe` somewhere.
  //
  // Example starting point below — replace with your voice.
  const playerLine =
    args.players.length > 0
      ? `Haven't heard back about ${args.players.join(" & ")} yet.`
      : "Haven't heard back yet.";

  return [
    `BGSL: ${args.event.title} — ${args.dateLine}.`,
    playerLine,
    `RSVP: ${link}`,
    `Stop texts: ${unsubscribe}`,
  ].join("\n");
}

export function renderEventUpdateText(args: {
  event: EventLike;
  guardianId: string;
  body: string;
}): string {
  const unsubscribe = textsOffUrl(
    signUnsubscribeToken({ userId: args.guardianId }),
  );

  // TODO (you): event-update copy. This is a manual coach/admin announcement,
  // not a reminder — tone should match. args.body is the coach's free-text.
  return [
    `BGSL — ${args.event.title}:`,
    args.body,
    `Stop texts: ${unsubscribe}`,
  ].join("\n");
}
