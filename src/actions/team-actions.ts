"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  adultUsers,
  playerGuardians,
  players,
  teamMemberships,
  teamPositionTemplates,
} from "@/db/schema";
import { requireTeamManager } from "@/actions/helpers";
import { sendTeamEmail } from "@/lib/notifications";
import { env } from "@/lib/env";
import { normalizeEmail, slugify } from "@/lib/utils";

const playerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  preferredName: z.string().trim().optional(),
  jerseyNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().int().min(0).max(99).nullable()),
  notes: z.string().trim().optional(),
});

const guardianSchema = z.object({
  playerId: z.string().uuid(),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  relationshipLabel: z.string().trim().min(1).max(32).default("Guardian"),
  sendInvite: z.boolean().default(false),
});

const staffSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  role: z.enum(["COACH", "ADMIN"]),
  sendInvite: z.boolean().default(false),
});

const positionSchema = z.object({
  code: z.string().trim().min(1).max(12),
  label: z.string().trim().min(1).max(40),
  sortOrder: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : 0))
    .pipe(z.number().int().min(0).max(999)),
  isActive: z.boolean().default(true),
});

async function upsertAdultWithEmail(input: {
  name: string;
  email: string;
  phone?: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const [adult] = await db
    .insert(adultUsers)
    .values({
      name: input.name,
      email: normalizedEmail,
      phone: input.phone || null,
    })
    .onConflictDoUpdate({
      target: adultUsers.email,
      set: {
        name: sql`coalesce(${adultUsers.name}, ${input.name})`,
        phone: sql`coalesce(${input.phone || null}, ${adultUsers.phone})`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return adult.id;
}

const updatePlayerSchema = z.object({
  playerId: z.string().uuid(),
  preferredName: z.string().trim().optional(),
  jerseyNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().int().min(0).max(99).nullable()),
});

export async function updatePlayerAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = updatePlayerSchema.parse({
    playerId: formData.get("playerId"),
    preferredName: formData.get("preferredName"),
    jerseyNumber: formData.get("jerseyNumber"),
  });

  await db
    .update(players)
    .set({
      preferredName: parsed.preferredName || null,
      jerseyNumber: parsed.jerseyNumber,
      updatedAt: new Date(),
    })
    .where(
      and(eq(players.id, parsed.playerId), eq(players.teamId, viewer.teamId)),
    );

  revalidatePath("/team");
  revalidatePath("/schedule");
}

export async function createPlayerAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = playerSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    preferredName: formData.get("preferredName"),
    jerseyNumber: formData.get("jerseyNumber"),
    notes: formData.get("notes"),
  });

  await db.insert(players).values({
    teamId: viewer.teamId,
    seasonId: viewer.seasonId,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    preferredName: parsed.preferredName || null,
    jerseyNumber: parsed.jerseyNumber,
    notes: parsed.notes || null,
  });

  revalidatePath("/team");
  revalidatePath("/schedule");
}

export async function addGuardianAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = guardianSchema.parse({
    playerId: formData.get("playerId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    relationshipLabel: formData.get("relationshipLabel"),
    sendInvite: formData.get("sendInvite") === "on",
  });

  const player = await db.query.players.findFirst({
    where: eq(players.id, parsed.playerId),
  });

  if (!player || player.teamId !== viewer.teamId) {
    throw new Error("That player is not on this team.");
  }

  const existingGuardians = await db.query.playerGuardians.findMany({
    where: eq(playerGuardians.playerId, parsed.playerId),
  });

  const guardianUserId = await upsertAdultWithEmail({
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
  });

  const alreadyLinked = existingGuardians.some(
    (guardian) => guardian.userId === guardianUserId,
  );

  if (!alreadyLinked && existingGuardians.length >= 2) {
    throw new Error("Version 1 supports up to two guardians per player.");
  }

  const existingMembership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(teamMemberships.teamId, viewer.teamId),
      eq(teamMemberships.userId, guardianUserId),
      eq(teamMemberships.role, "PARENT"),
    ),
  });

  if (!existingMembership) {
    await db.insert(teamMemberships).values({
      teamId: viewer.teamId,
      userId: guardianUserId,
      role: "PARENT",
    });
  } else {
    await db
      .insert(teamMemberships)
      .values({
        teamId: viewer.teamId,
        userId: guardianUserId,
        role: "PARENT",
      })
      .onConflictDoNothing();
  }

  if (alreadyLinked) {
    const guardianRecord = existingGuardians.find(
      (guardian) => guardian.userId === guardianUserId,
    );

    if (guardianRecord) {
      await db
        .update(playerGuardians)
        .set({
          relationshipLabel: parsed.relationshipLabel,
          updatedAt: new Date(),
        })
        .where(eq(playerGuardians.id, guardianRecord.id));
    }
  } else {
    await db.insert(playerGuardians).values({
      playerId: parsed.playerId,
      userId: guardianUserId,
      relationshipLabel: parsed.relationshipLabel,
      sortOrder: existingGuardians.length,
    });
  }

  if (parsed.sendInvite) {
    await sendTeamEmail({
      teamId: viewer.teamId,
      createdByUserId: viewer.userId,
      kind: "INVITE",
      subject: `You’re invited to ${viewer.team.name}`,
      body: `${parsed.name},\n\nYou’ve been added to ${viewer.team.name} for ${viewer.seasonName ?? "this season"}.\n\nSign in here to view the schedule, update availability, and stay in the loop:\n${env.NEXT_PUBLIC_APP_URL}/sign-in?email=${encodeURIComponent(
        normalizeEmail(parsed.email),
      )}`,
      recipients: [
        {
          email: parsed.email,
          userId: guardianUserId,
          playerId: parsed.playerId,
        },
      ],
      metadata: {
        inviteType: "guardian",
      },
    });
  }

  revalidatePath("/team");
  revalidatePath("/settings");
}

export async function addStaffRoleAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = staffSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    sendInvite: formData.get("sendInvite") === "on",
  });

  const userId = await upsertAdultWithEmail({
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
  });

  await db
    .insert(teamMemberships)
    .values({
      teamId: viewer.teamId,
      userId,
      role: parsed.role,
    })
    .onConflictDoNothing();

  if (parsed.sendInvite) {
    await sendTeamEmail({
      teamId: viewer.teamId,
      createdByUserId: viewer.userId,
      kind: "INVITE",
      subject: `You’ve been added as ${parsed.role.toLowerCase()} to ${viewer.team.name}`,
      body: `${parsed.name},\n\nYou’ve been added as a ${parsed.role.toLowerCase()} for ${viewer.team.name}.\n\nUse this link to sign in:\n${env.NEXT_PUBLIC_APP_URL}/sign-in?email=${encodeURIComponent(
        normalizeEmail(parsed.email),
      )}`,
      recipients: [
        {
          email: parsed.email,
          userId,
        },
      ],
      metadata: {
        inviteType: parsed.role.toLowerCase(),
      },
    });
  }

  revalidatePath("/team");
  revalidatePath("/settings");
}

export async function savePositionTemplateAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = positionSchema.parse({
    code: formData.get("code"),
    label: formData.get("label"),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive") === "on",
  });

  const normalizedCode = slugify(parsed.code).toUpperCase().replaceAll("-", "");

  await db
    .insert(teamPositionTemplates)
    .values({
      teamId: viewer.teamId,
      code: normalizedCode,
      label: parsed.label,
      sortOrder: parsed.sortOrder,
      isActive: parsed.isActive,
    })
    .onConflictDoUpdate({
      target: [teamPositionTemplates.teamId, teamPositionTemplates.code],
      set: {
        label: parsed.label,
        sortOrder: parsed.sortOrder,
        isActive: parsed.isActive,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/team");
  revalidatePath("/lineups");
}
