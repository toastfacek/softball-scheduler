import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  adultUsers,
  emailMessages,
  events,
  playerEventResponses,
  playerGuardians,
  players,
} from "@/db/schema";
import { eventTypeLabel } from "@/lib/event-display";
import { verifyRsvpToken } from "@/lib/rsvp-tokens";
import { formatEventDateTimeRange } from "@/lib/time";

import { RsvpForm } from "./rsvp-form";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string }>;
};

export default async function RsvpLandingPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { s } = await searchParams;

  const claims = verifyRsvpToken(token);

  if (!claims) {
    return <ExpiredLinkScreen />;
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, claims.eventId),
  });

  if (!event) {
    notFound();
  }

  const guardian = await db.query.adultUsers.findFirst({
    where: eq(adultUsers.id, claims.guardianId),
  });

  if (!guardian) {
    notFound();
  }

  const linkedPlayers = await db
    .select({
      playerId: playerGuardians.playerId,
      firstName: players.firstName,
      lastName: players.lastName,
      preferredName: players.preferredName,
      relationshipLabel: playerGuardians.relationshipLabel,
    })
    .from(playerGuardians)
    .innerJoin(players, eq(players.id, playerGuardians.playerId))
    .where(eq(playerGuardians.userId, claims.guardianId))
    .then((rows) =>
      rows.map((r) => ({
        playerId: r.playerId,
        playerName: `${r.preferredName ?? r.firstName} ${r.lastName}`,
        relationshipLabel: r.relationshipLabel,
      })),
    );

  if (linkedPlayers.length === 0) {
    return <NoPlayersScreen />;
  }

  const existingResponses = await db
    .select({
      playerId: playerEventResponses.playerId,
      status: playerEventResponses.status,
      note: playerEventResponses.note,
    })
    .from(playerEventResponses)
    .where(eq(playerEventResponses.eventId, claims.eventId));

  const responsesByPlayer = new Map(
    existingResponses.map((r) => [r.playerId, r]),
  );

  const preselectStatus =
    s === "AVAILABLE" || s === "UNAVAILABLE" || s === "MAYBE" ? s : null;

  const guardianFirstName = guardian.name?.split(" ")[0] ?? "there";
  const coachNote = claims.messageId
    ? await getBroadcastNote({
        messageId: claims.messageId,
        eventId: event.id,
        eventTitle: event.title,
      })
    : null;

  return (
    <div className="rsvp-shell">
      <header className="rsvp-header">
        <div className="rsvp-eyebrow">Beverly Girls Softball League</div>
        <h1 className="rsvp-greeting">Hi {guardianFirstName} —</h1>
        <div className="rsvp-event-card">
          <div className="rsvp-event-chip">{eventTypeLabel(event.type)}</div>
          <h2 className="rsvp-event-title">{event.title}</h2>
          <div className="rsvp-event-meta">
            {formatEventDateTimeRange(event.startsAt, event.endsAt)}
          </div>
          {event.venueName ? (
            <div className="rsvp-event-meta">
              {event.venueName}
              {event.city ? `, ${event.city}` : ""}
              {event.state ? `, ${event.state}` : ""}
            </div>
          ) : null}
        </div>
      </header>

      {coachNote ? (
        <section className="rsvp-card">
          <p className="rsvp-prompt" style={{ marginBottom: "0.75rem" }}>
            Note from your coach
          </p>
          <p
            className="rsvp-event-meta"
            style={{ color: "var(--navy)", whiteSpace: "pre-line" }}
          >
            {coachNote}
          </p>
        </section>
      ) : null}

      <RsvpForm
        token={token}
        players={linkedPlayers.map((p) => {
          const existing = responsesByPlayer.get(p.playerId);
          return {
            id: p.playerId,
            name: p.playerName,
            currentStatus: existing?.status ?? null,
            currentNote: existing?.note ?? null,
          };
        })}
        preselectStatus={preselectStatus}
      />

      <footer className="rsvp-footer">
        You can revisit this link anytime in the next 72 hours to update your
        response.
      </footer>
    </div>
  );
}

async function getBroadcastNote({
  messageId,
  eventId,
  eventTitle,
}: {
  messageId: string;
  eventId: string;
  eventTitle: string;
}) {
  const message = await db.query.emailMessages.findFirst({
    where: and(
      eq(emailMessages.id, messageId),
      eq(emailMessages.eventId, eventId),
      eq(emailMessages.kind, "BROADCAST"),
    ),
  });

  if (!message) return null;

  const lines = message.body.split(/\r?\n/);
  const body =
    lines[0]?.trim() === eventTitle.trim()
      ? lines.slice(1).join("\n").trim()
      : message.body.trim();

  return body || null;
}

function ExpiredLinkScreen() {
  return (
    <div className="rsvp-shell rsvp-shell--centered">
      <div className="rsvp-event-card">
        <h1 className="rsvp-event-title">Link expired</h1>
        <p className="rsvp-event-meta" style={{ marginTop: "0.5rem" }}>
          This RSVP link is no longer valid. Please ask your coach to send a
          fresh one, or reach out directly.
        </p>
      </div>
    </div>
  );
}

function NoPlayersScreen() {
  return (
    <div className="rsvp-shell rsvp-shell--centered">
      <div className="rsvp-event-card">
        <h1 className="rsvp-event-title">No players linked</h1>
        <p className="rsvp-event-meta" style={{ marginTop: "0.5rem" }}>
          We couldn&apos;t find any players linked to this account. Please
          contact your coach.
        </p>
      </div>
    </div>
  );
}
