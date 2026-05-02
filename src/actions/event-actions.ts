"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireTeamManager, requireViewer } from "@/actions/helpers";
import { db } from "@/db";
import {
  adultEventResponses,
  adultUsers,
  events,
  playerEventResponses,
  playerGuardians,
  players,
  teamMemberships,
} from "@/db/schema";
import type { EventType } from "@/db/schema";
import { listEventUpdateRecipients } from "@/lib/data";
import {
  renderEventDetailsText,
  renderEventRsvpEmail,
} from "@/lib/email-templates";
import { sendTeamEmail } from "@/lib/notifications";
import { verifyRsvpToken } from "@/lib/rsvp-tokens";
import { sendTeamText } from "@/lib/text-notifications";
import { renderEventUpdateText } from "@/lib/text-templates";
import { localInputToDate } from "@/lib/time";

const eventSchema = z.object({
  eventId: z.string().uuid().optional(),
  type: z.enum(["GAME", "PRACTICE", "TEAM_EVENT"]),
  status: z.enum(["SCHEDULED", "CANCELED", "COMPLETED"]),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  startsAt: z.string().trim().min(1),
  venueName: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
});

// Default durations — practice 90m, game 2h, team event 2h. Used to derive endsAt
// at save time so the form only collects a single start datetime.
const DEFAULT_DURATION_MIN = {
  PRACTICE: 90,
  GAME: 120,
  TEAM_EVENT: 120,
} as const;
function defaultEndFor(startsAt: Date, type: EventType): Date {
  return new Date(startsAt.getTime() + DEFAULT_DURATION_MIN[type] * 60 * 1000);
}

const playerResponseSchema = z.object({
  eventId: z.string().uuid(),
  playerId: z.string().uuid(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  note: z.string().trim().optional(),
});

const coachPlayerResponseSchema = z.object({
  eventId: z.string().uuid(),
  playerId: z.string().uuid(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
});

const adultResponseSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  note: z.string().trim().optional(),
});

const actualAttendanceSchema = z.object({
  eventId: z.string().uuid(),
  subjectId: z.string().uuid(),
  actualAttendance: z.enum(["UNKNOWN", "PRESENT", "ABSENT"]),
});

const eventUpdateSchema = z.object({
  eventId: z.string().uuid(),
  audience: z.enum([
    "ALL_GUARDIANS",
    "RESPONDED_PLAYERS",
    "NON_RESPONDERS",
    "STAFF",
    "EVERYONE",
  ]),
  subject: z.string().trim().min(3),
  body: z.string().trim().min(3),
});

async function ensureEventBelongsToTeam(eventId: string, teamId: string) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event || event.teamId !== teamId) {
    throw new Error("That event is not part of this team.");
  }

  return event;
}

function revalidateEventResponseViews(eventId: string) {
  revalidatePath("/schedule");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/attendance`);
  revalidatePath(`/lineups/${eventId}`);
}

export async function createEventAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = eventSchema.parse({
    type: formData.get("type"),
    status: formData.get("status"),
    title: formData.get("title"),
    description: formData.get("description"),
    startsAt: formData.get("startsAt"),
    venueName: formData.get("venueName"),
    addressLine1: formData.get("addressLine1"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
  });

  const startsAt = localInputToDate(parsed.startsAt);

  await db.insert(events).values({
    teamId: viewer.teamId,
    seasonId: viewer.seasonId,
    type: parsed.type,
    status: parsed.status,
    title: parsed.title,
    description: parsed.description || null,
    startsAt,
    endsAt: defaultEndFor(startsAt, parsed.type),
    venueName: parsed.venueName || null,
    addressLine1: parsed.addressLine1 || null,
    city: parsed.city || null,
    state: parsed.state || null,
    postalCode: parsed.postalCode || null,
    timezone: viewer.team.timezone,
  });

  revalidatePath("/schedule");
  redirect("/schedule?saved=event");
}

export async function updateEventAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = eventSchema.parse({
    eventId: formData.get("eventId"),
    type: formData.get("type"),
    status: formData.get("status"),
    title: formData.get("title"),
    description: formData.get("description"),
    startsAt: formData.get("startsAt"),
    venueName: formData.get("venueName"),
    addressLine1: formData.get("addressLine1"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
  });

  if (!parsed.eventId) {
    throw new Error("Missing event id.");
  }

  const existing = await ensureEventBelongsToTeam(
    parsed.eventId,
    viewer.teamId,
  );

  const startsAt = localInputToDate(parsed.startsAt);

  // Preserve a custom endsAt if the user didn't touch the schedule shape.
  // Only recompute from the default-duration rule when the type or start time
  // actually changed — otherwise editing just the title/notes/location would
  // silently flatten any non-standard duration a prior save had.
  const startChanged = startsAt.getTime() !== existing.startsAt.getTime();
  const typeChanged = parsed.type !== existing.type;
  const endsAt =
    startChanged || typeChanged
      ? defaultEndFor(startsAt, parsed.type)
      : existing.endsAt;

  await db
    .update(events)
    .set({
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      description: parsed.description || null,
      startsAt,
      endsAt,
      venueName: parsed.venueName || null,
      addressLine1: parsed.addressLine1 || null,
      city: parsed.city || null,
      state: parsed.state || null,
      postalCode: parsed.postalCode || null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, parsed.eventId));

  revalidatePath("/schedule");
  revalidatePath(`/events/${parsed.eventId}`);
  redirect(`/events/${parsed.eventId}?saved=event-edit`);
}

export async function updatePlayerAvailabilityAction(formData: FormData) {
  const viewer = await requireViewer();
  const parsed = playerResponseSchema.parse({
    eventId: formData.get("eventId"),
    playerId: formData.get("playerId"),
    status: formData.get("status"),
    note: formData.get("note"),
  });

  if (!viewer.linkedPlayerIds.includes(parsed.playerId)) {
    throw new Error("You can only update players linked to your account.");
  }

  await ensureEventBelongsToTeam(parsed.eventId, viewer.teamId);

  const source = viewer.roles.some((r) => r === "COACH" || r === "ADMIN")
    ? ("COACH_MANUAL" as const)
    : ("APP" as const);
  const now = new Date();

  await db
    .insert(playerEventResponses)
    .values({
      eventId: parsed.eventId,
      playerId: parsed.playerId,
      status: parsed.status,
      note: parsed.note || null,
      respondedByUserId: viewer.userId,
      respondedAt: now,
      responseSource: source,
    })
    .onConflictDoUpdate({
      target: [playerEventResponses.eventId, playerEventResponses.playerId],
      set: {
        status: parsed.status,
        note: parsed.note || null,
        respondedByUserId: viewer.userId,
        respondedAt: now,
        responseSource: source,
        updatedAt: now,
      },
    });

  revalidateEventResponseViews(parsed.eventId);
}

export async function updatePlayerAvailabilityByCoachAction(
  formData: FormData,
) {
  const viewer = await requireTeamManager();
  const parsed = coachPlayerResponseSchema.parse({
    eventId: formData.get("eventId"),
    playerId: formData.get("playerId"),
    status: formData.get("status"),
  });

  await ensureEventBelongsToTeam(parsed.eventId, viewer.teamId);

  const player = await db.query.players.findFirst({
    where: and(
      eq(players.id, parsed.playerId),
      eq(players.teamId, viewer.teamId),
    ),
  });

  if (!player) {
    throw new Error("That player is not part of this team.");
  }

  const now = new Date();

  await db
    .insert(playerEventResponses)
    .values({
      eventId: parsed.eventId,
      playerId: parsed.playerId,
      status: parsed.status,
      respondedByUserId: viewer.userId,
      respondedAt: now,
      responseSource: "COACH_MANUAL",
    })
    .onConflictDoUpdate({
      target: [playerEventResponses.eventId, playerEventResponses.playerId],
      set: {
        status: parsed.status,
        respondedByUserId: viewer.userId,
        respondedAt: now,
        responseSource: "COACH_MANUAL",
        updatedAt: now,
      },
    });

  revalidateEventResponseViews(parsed.eventId);
}

const rsvpLinkSchema = z.object({
  token: z.string().min(10),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  note: z.string().trim().max(500).optional(),
  playerIds: z.array(z.string().uuid()).optional(),
});

export type RsvpFromLinkResult = {
  success: true;
  updated: { playerId: string; playerName: string }[];
  status: "AVAILABLE" | "UNAVAILABLE" | "MAYBE";
};

export async function recordRsvpFromLinkAction(input: {
  token: string;
  status: "AVAILABLE" | "UNAVAILABLE" | "MAYBE";
  note?: string;
  playerIds?: string[];
}): Promise<RsvpFromLinkResult> {
  const parsed = rsvpLinkSchema.parse(input);
  const claims = verifyRsvpToken(parsed.token);
  if (!claims) {
    throw new Error("This RSVP link is invalid or has expired.");
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, claims.eventId),
  });

  if (!event) {
    throw new Error("This RSVP link points to an event that no longer exists.");
  }

  const linked = await db
    .select({
      playerId: playerGuardians.playerId,
      firstName: players.firstName,
      lastName: players.lastName,
      preferredName: players.preferredName,
    })
    .from(playerGuardians)
    .innerJoin(players, eq(players.id, playerGuardians.playerId))
    .where(
      and(
        eq(playerGuardians.userId, claims.guardianId),
        eq(players.teamId, event.teamId),
      ),
    )
    .then((rows) =>
      rows.map((r) => ({
        playerId: r.playerId,
        playerName: `${r.preferredName ?? r.firstName} ${r.lastName}`,
      })),
    );

  if (linked.length === 0) {
    throw new Error("This guardian has no players on the team.");
  }

  const eligibleIds = new Set(linked.map((l) => l.playerId));
  const targetPlayerIds = parsed.playerIds
    ? Array.from(new Set(parsed.playerIds)).filter((id) => eligibleIds.has(id))
    : linked.map((l) => l.playerId);

  if (targetPlayerIds.length === 0) {
    throw new Error("No matching players for this link.");
  }

  const now = new Date();
  const note = parsed.note?.trim() || null;

  for (const playerId of targetPlayerIds) {
    await db
      .insert(playerEventResponses)
      .values({
        eventId: claims.eventId,
        playerId,
        status: parsed.status,
        note,
        respondedByUserId: claims.guardianId,
        respondedAt: now,
        responseSource: claims.source,
      })
      .onConflictDoUpdate({
        target: [playerEventResponses.eventId, playerEventResponses.playerId],
        set: {
          status: parsed.status,
          note,
          respondedByUserId: claims.guardianId,
          respondedAt: now,
          responseSource: claims.source,
          updatedAt: now,
        },
      });
  }

  revalidatePath(`/events/${claims.eventId}`);

  return {
    success: true,
    status: parsed.status,
    updated: linked
      .filter((l) => targetPlayerIds.includes(l.playerId))
      .map((l) => ({ playerId: l.playerId, playerName: l.playerName })),
  };
}

export async function updateAdultAvailabilityAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = adultResponseSchema.parse({
    eventId: formData.get("eventId"),
    status: formData.get("status"),
    note: formData.get("note"),
  });

  await ensureEventBelongsToTeam(parsed.eventId, viewer.teamId);

  const now = new Date();

  await db
    .insert(adultEventResponses)
    .values({
      eventId: parsed.eventId,
      userId: viewer.userId,
      status: parsed.status,
      note: parsed.note || null,
      respondedAt: now,
    })
    .onConflictDoUpdate({
      target: [adultEventResponses.eventId, adultEventResponses.userId],
      set: {
        status: parsed.status,
        note: parsed.note || null,
        respondedAt: now,
        updatedAt: now,
      },
    });

  revalidatePath("/schedule");
  revalidatePath(`/events/${parsed.eventId}`);
}

export async function markPlayerActualAttendanceAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = actualAttendanceSchema.parse({
    eventId: formData.get("eventId"),
    subjectId: formData.get("playerId"),
    actualAttendance: formData.get("actualAttendance"),
  });

  await ensureEventBelongsToTeam(parsed.eventId, viewer.teamId);

  const player = await db.query.players.findFirst({
    where: eq(players.id, parsed.subjectId),
  });

  if (!player || player.teamId !== viewer.teamId) {
    throw new Error("That player is not part of this team.");
  }

  const now = new Date();

  await db
    .insert(playerEventResponses)
    .values({
      eventId: parsed.eventId,
      playerId: parsed.subjectId,
      status:
        parsed.actualAttendance === "PRESENT" ? "AVAILABLE" : "UNAVAILABLE",
      actualAttendance: parsed.actualAttendance,
      respondedByUserId: viewer.userId,
      note: "Recorded by coach on event day.",
      respondedAt: now,
    })
    .onConflictDoUpdate({
      target: [playerEventResponses.eventId, playerEventResponses.playerId],
      set: {
        actualAttendance: parsed.actualAttendance,
        updatedAt: now,
      },
    });

  revalidatePath(`/events/${parsed.eventId}`);
}

export async function markAdultActualAttendanceAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = actualAttendanceSchema.parse({
    eventId: formData.get("eventId"),
    subjectId: formData.get("userId"),
    actualAttendance: formData.get("actualAttendance"),
  });

  await ensureEventBelongsToTeam(parsed.eventId, viewer.teamId);

  const teamMember = await db.query.teamMemberships.findFirst({
    where: and(
      eq(teamMemberships.teamId, viewer.teamId),
      eq(teamMemberships.userId, parsed.subjectId),
    ),
  });

  if (!teamMember) {
    throw new Error("That adult is not part of this team.");
  }

  const now = new Date();

  await db
    .insert(adultEventResponses)
    .values({
      eventId: parsed.eventId,
      userId: parsed.subjectId,
      status:
        parsed.actualAttendance === "PRESENT" ? "AVAILABLE" : "UNAVAILABLE",
      actualAttendance: parsed.actualAttendance,
      note: "Recorded by coach on event day.",
      respondedAt: now,
    })
    .onConflictDoUpdate({
      target: [adultEventResponses.eventId, adultEventResponses.userId],
      set: {
        actualAttendance: parsed.actualAttendance,
        updatedAt: now,
      },
    });

  revalidatePath(`/events/${parsed.eventId}`);
}

export async function sendEventUpdateAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = eventUpdateSchema.parse({
    eventId: formData.get("eventId"),
    audience: formData.get("audience"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });

  const event = await ensureEventBelongsToTeam(parsed.eventId, viewer.teamId);
  const recipients = await listEventUpdateRecipients(
    viewer.teamId,
    parsed.eventId,
    parsed.audience,
  );

  if (recipients.length === 0) {
    revalidatePath(`/events/${parsed.eventId}`);
    redirect(`/events/${parsed.eventId}?saved=email-empty`);
  }

  const guardianNames = await guardianFirstNamesById(
    recipients.map((r) => r.userId).filter(Boolean) as string[],
  );

  // STAFF / EVERYONE audiences include coaches and admins who may not be
  // guardians. RSVP-link templates are scoped to a guardianId and render a
  // broken CTA for non-guardians ("No players linked" on the RSVP page), so
  // only render the RSVP variant for recipients that actually have a
  // guardian link. Others fall back to the canonical plain-text body.
  const guardianUserIdRows = await db
    .selectDistinct({ userId: playerGuardians.userId })
    .from(playerGuardians)
    .innerJoin(players, eq(playerGuardians.playerId, players.id))
    .where(eq(players.teamId, viewer.teamId));
  const guardianUserIds = new Set(guardianUserIdRows.map((r) => r.userId));

  const renderEmailBody = (
    recipient: { userId?: string | null },
    context: { messageId: string },
  ) => {
    if (!recipient.userId || !guardianUserIds.has(recipient.userId)) {
      // Non-guardian (coach/admin with no linked players) — fall back to
      // the canonical body so they don't receive a broken RSVP CTA.
      return {};
    }
    const firstName = guardianNames.get(recipient.userId) ?? "there";
    return renderEventRsvpEmail({
      event,
      guardianId: recipient.userId,
      guardianFirstName: firstName,
      subject: parsed.subject,
      bodyIntro: parsed.body,
      messageId: context.messageId,
    });
  };

  const textRecipients = recipients.filter(
    (r) => r.textOptIn && r.phone,
  );

  const failedTextUserIds = new Set<string>();

  if (textRecipients.length > 0) {
    const textMessage = await sendTeamText({
      teamId: viewer.teamId,
      createdByUserId: viewer.userId,
      eventId: parsed.eventId,
      kind: "BROADCAST",
      body: `${event.title}: ${parsed.body}`,
      recipients: textRecipients.map((r) => ({
        userId: r.userId,
        phone: r.phone,
      })),
      metadata: { audience: parsed.audience },
      renderBody: ({ userId }) => {
        if (!userId) return {};
        return {
          body: renderEventUpdateText({
            event,
            guardianId: userId,
            body: parsed.body,
          }),
        };
      },
    });

    const textResultByUserId = new Map(
      textMessage?.sendResults
        .filter((result) => result.recipient.userId)
        .map((result) => [result.recipient.userId!, result]) ?? [],
    );

    for (const recipient of textRecipients) {
      const result = textResultByUserId.get(recipient.userId);
      if (!result || result.deliveryStatus === "FAILED") {
        failedTextUserIds.add(recipient.userId);
      }
    }
  }

  const textUserIds = new Set(textRecipients.map((r) => r.userId));
  const emailRecipients = recipients.filter(
    (r) => !textUserIds.has(r.userId) || failedTextUserIds.has(r.userId),
  );

  await sendTeamEmail({
    teamId: viewer.teamId,
    createdByUserId: viewer.userId,
    eventId: parsed.eventId,
    kind: "BROADCAST",
    subject: parsed.subject,
    body: [parsed.body, "", renderEventDetailsText(event)].join("\n"),
    recipients: emailRecipients,
    metadata: {
      audience: parsed.audience,
      smsFallbackCount: failedTextUserIds.size,
    },
    renderBody: renderEmailBody,
  });

  revalidatePath(`/events/${parsed.eventId}`);
  redirect(`/events/${parsed.eventId}?saved=email`);
}

async function guardianFirstNamesById(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: adultUsers.id, name: adultUsers.name })
    .from(adultUsers)
    .where(inArray(adultUsers.id, userIds));
  return new Map(
    rows.map((row) => [row.id, (row.name ?? "").split(" ")[0] || "there"]),
  );
}
