"use server";

import { and, eq } from "drizzle-orm";
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
} from "@/db/schema";
import { inArray } from "drizzle-orm";
import { listEventUpdateRecipients } from "@/lib/data";
import { renderEventRsvpEmail } from "@/lib/email-templates";
import { sendTeamEmail } from "@/lib/notifications";
import { verifyRsvpToken } from "@/lib/rsvp-tokens";
import { localInputToDate } from "@/lib/time";

const eventSchema = z.object({
  eventId: z.string().uuid().optional(),
  type: z.enum(["GAME", "PRACTICE"]),
  status: z.enum(["SCHEDULED", "CANCELED", "COMPLETED"]),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  startsAt: z.string().trim().min(1),
  venueName: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
});

// Default durations — practice 90m, game 2h. Used to derive endsAt at save time
// so the form only collects a single start datetime.
const DEFAULT_DURATION_MIN = { PRACTICE: 90, GAME: 120 } as const;
function defaultEndFor(startsAt: Date, type: "PRACTICE" | "GAME"): Date {
  return new Date(startsAt.getTime() + DEFAULT_DURATION_MIN[type] * 60 * 1000);
}

const playerResponseSchema = z.object({
  eventId: z.string().uuid(),
  playerId: z.string().uuid(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  note: z.string().trim().optional(),
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
  audience: z.enum(["ALL_GUARDIANS", "RESPONDED_PLAYERS"]),
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
    addressLine2: formData.get("addressLine2"),
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
    addressLine2: parsed.addressLine2 || null,
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
    addressLine2: formData.get("addressLine2"),
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
      addressLine2: parsed.addressLine2 || null,
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

  const existing = await db.query.playerEventResponses.findFirst({
    where: and(
      eq(playerEventResponses.eventId, parsed.eventId),
      eq(playerEventResponses.playerId, parsed.playerId),
    ),
  });

  const source = viewer.roles.some((r) => r === "COACH" || r === "ADMIN")
    ? ("COACH_MANUAL" as const)
    : ("APP" as const);

  if (existing) {
    await db
      .update(playerEventResponses)
      .set({
        status: parsed.status,
        note: parsed.note || null,
        respondedByUserId: viewer.userId,
        respondedAt: new Date(),
        responseSource: source,
        updatedAt: new Date(),
      })
      .where(eq(playerEventResponses.id, existing.id));
  } else {
    await db.insert(playerEventResponses).values({
      eventId: parsed.eventId,
      playerId: parsed.playerId,
      status: parsed.status,
      note: parsed.note || null,
      respondedByUserId: viewer.userId,
      responseSource: source,
    });
  }

  revalidatePath("/schedule");
  revalidatePath(`/events/${parsed.eventId}`);
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

  const linked = await db
    .select({
      playerId: playerGuardians.playerId,
      firstName: players.firstName,
      lastName: players.lastName,
      preferredName: players.preferredName,
    })
    .from(playerGuardians)
    .innerJoin(players, eq(players.id, playerGuardians.playerId))
    .where(eq(playerGuardians.userId, claims.guardianId))
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
    ? parsed.playerIds.filter((id) => eligibleIds.has(id))
    : linked.map((l) => l.playerId);

  if (targetPlayerIds.length === 0) {
    throw new Error("No matching players for this link.");
  }

  const now = new Date();
  const note = parsed.note?.trim() || null;

  for (const playerId of targetPlayerIds) {
    const existing = await db.query.playerEventResponses.findFirst({
      where: and(
        eq(playerEventResponses.eventId, claims.eventId),
        eq(playerEventResponses.playerId, playerId),
      ),
    });

    if (existing) {
      await db
        .update(playerEventResponses)
        .set({
          status: parsed.status,
          note,
          respondedByUserId: claims.guardianId,
          respondedAt: now,
          responseSource: "EMAIL_LINK",
          updatedAt: now,
        })
        .where(eq(playerEventResponses.id, existing.id));
    } else {
      await db.insert(playerEventResponses).values({
        eventId: claims.eventId,
        playerId,
        status: parsed.status,
        note,
        respondedByUserId: claims.guardianId,
        respondedAt: now,
        responseSource: "EMAIL_LINK",
      });
    }
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

  const existing = await db.query.adultEventResponses.findFirst({
    where: and(
      eq(adultEventResponses.eventId, parsed.eventId),
      eq(adultEventResponses.userId, viewer.userId),
    ),
  });

  if (existing) {
    await db
      .update(adultEventResponses)
      .set({
        status: parsed.status,
        note: parsed.note || null,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adultEventResponses.id, existing.id));
  } else {
    await db.insert(adultEventResponses).values({
      eventId: parsed.eventId,
      userId: viewer.userId,
      status: parsed.status,
      note: parsed.note || null,
    });
  }

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

  const existing = await db.query.playerEventResponses.findFirst({
    where: and(
      eq(playerEventResponses.eventId, parsed.eventId),
      eq(playerEventResponses.playerId, parsed.subjectId),
    ),
  });

  if (existing) {
    await db
      .update(playerEventResponses)
      .set({
        actualAttendance: parsed.actualAttendance,
        updatedAt: new Date(),
      })
      .where(eq(playerEventResponses.id, existing.id));
  } else {
    await db.insert(playerEventResponses).values({
      eventId: parsed.eventId,
      playerId: parsed.subjectId,
      status:
        parsed.actualAttendance === "PRESENT" ? "AVAILABLE" : "UNAVAILABLE",
      actualAttendance: parsed.actualAttendance,
      respondedByUserId: viewer.userId,
      note: "Recorded by coach on event day.",
    });
  }

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

  const existing = await db.query.adultEventResponses.findFirst({
    where: and(
      eq(adultEventResponses.eventId, parsed.eventId),
      eq(adultEventResponses.userId, parsed.subjectId),
    ),
  });

  if (existing) {
    await db
      .update(adultEventResponses)
      .set({
        actualAttendance: parsed.actualAttendance,
        updatedAt: new Date(),
      })
      .where(eq(adultEventResponses.id, existing.id));
  } else {
    await db.insert(adultEventResponses).values({
      eventId: parsed.eventId,
      userId: parsed.subjectId,
      status:
        parsed.actualAttendance === "PRESENT" ? "AVAILABLE" : "UNAVAILABLE",
      actualAttendance: parsed.actualAttendance,
      note: "Recorded by coach on event day.",
    });
  }

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

  const guardianNames = await guardianFirstNamesById(
    recipients.map((r) => r.userId).filter(Boolean) as string[],
  );

  await sendTeamEmail({
    teamId: viewer.teamId,
    createdByUserId: viewer.userId,
    eventId: parsed.eventId,
    kind: "BROADCAST",
    subject: parsed.subject,
    body: `${event.title}\n${parsed.body}`,
    recipients,
    metadata: {
      audience: parsed.audience,
    },
    renderBody: (recipient) => {
      if (!recipient.userId) {
        // Fall back to the canonical body for unlinked recipients (no RSVP link
        // without a guardian id to scope it to).
        return {};
      }
      const firstName = guardianNames.get(recipient.userId) ?? "there";
      return renderEventRsvpEmail({
        event,
        guardianId: recipient.userId,
        guardianFirstName: firstName,
        subjectPrefix: "Update",
        bodyIntro: parsed.body,
      });
    },
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

