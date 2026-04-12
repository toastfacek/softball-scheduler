"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireTeamManager, requireViewer } from "@/actions/helpers";
import { db } from "@/db";
import {
  adultEventResponses,
  events,
  playerEventResponses,
  players,
} from "@/db/schema";
import { listEventUpdateRecipients } from "@/lib/data";
import { sendTeamEmail } from "@/lib/notifications";
import { localInputToDate } from "@/lib/time";

const eventSchema = z.object({
  eventId: z.string().uuid().optional(),
  type: z.enum(["GAME", "PRACTICE"]),
  status: z.enum(["SCHEDULED", "CANCELED", "COMPLETED"]),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().optional(),
  venueName: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
});

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
    endsAt: formData.get("endsAt"),
    venueName: formData.get("venueName"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
  });

  await db.insert(events).values({
    teamId: viewer.teamId,
    seasonId: viewer.seasonId,
    type: parsed.type,
    status: parsed.status,
    title: parsed.title,
    description: parsed.description || null,
    startsAt: localInputToDate(parsed.startsAt),
    endsAt: parsed.endsAt ? localInputToDate(parsed.endsAt) : null,
    venueName: parsed.venueName || null,
    addressLine1: parsed.addressLine1 || null,
    addressLine2: parsed.addressLine2 || null,
    city: parsed.city || null,
    state: parsed.state || null,
    postalCode: parsed.postalCode || null,
    timezone: viewer.team.timezone,
  });

  revalidatePath("/schedule");
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
    endsAt: formData.get("endsAt"),
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

  await ensureEventBelongsToTeam(parsed.eventId, viewer.teamId);

  await db
    .update(events)
    .set({
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      description: parsed.description || null,
      startsAt: localInputToDate(parsed.startsAt),
      endsAt: parsed.endsAt ? localInputToDate(parsed.endsAt) : null,
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

  if (existing) {
    await db
      .update(playerEventResponses)
      .set({
        status: parsed.status,
        note: parsed.note || null,
        respondedByUserId: viewer.userId,
        respondedAt: new Date(),
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
    });
  }

  revalidatePath("/schedule");
  revalidatePath(`/events/${parsed.eventId}`);
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
  });

  revalidatePath(`/events/${parsed.eventId}`);
}

