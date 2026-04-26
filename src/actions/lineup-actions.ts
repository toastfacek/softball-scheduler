"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireLineupManager } from "@/actions/helpers";
import { db } from "@/db";
import {
  battingSlots,
  events,
  inningAssignments,
  lineupPlans,
  lineupPresetAssignments,
  lineupPresetSlots,
  lineupPresets,
  playerEventResponses,
  players,
  teamPositionTemplates,
} from "@/db/schema";

const saveLineupSchema = z.object({
  eventId: z.string().uuid(),
  inningsCount: z.coerce.number().int().min(1).max(9),
});

type AssignmentValue = {
  inningNumber: number;
  playerId: string;
  positionTemplateId: string;
  positionCode: string;
  positionLabel: string;
};

export async function saveLineupAction(formData: FormData) {
  const viewer = await requireLineupManager();
  const parsed = saveLineupSchema.parse({
    eventId: formData.get("eventId"),
    inningsCount: formData.get("inningsCount"),
  });

  const event = await db.query.events.findFirst({
    where: and(
      eq(events.id, parsed.eventId),
      eq(events.teamId, viewer.teamId),
      eq(events.type, "GAME"),
    ),
  });

  if (!event) {
    throw new Error("Only game events can have lineups.");
  }

  const [teamPlayers, positionRows, existingPlan, responseRows] =
    await Promise.all([
      db.query.players.findMany({
        where: eq(players.teamId, viewer.teamId),
        orderBy: [players.lastName, players.firstName],
      }),
      db.query.teamPositionTemplates.findMany({
        where: and(
          eq(teamPositionTemplates.teamId, viewer.teamId),
          eq(teamPositionTemplates.isActive, true),
        ),
      }),
      db.query.lineupPlans.findFirst({
        where: eq(lineupPlans.eventId, parsed.eventId),
      }),
      db.query.playerEventResponses.findMany({
        where: eq(playerEventResponses.eventId, parsed.eventId),
      }),
    ]);

  const unavailablePlayerIds = new Set(
    responseRows
      .filter((response) => response.status === "UNAVAILABLE")
      .map((response) => response.playerId),
  );
  const eligiblePlayerIds = new Set(
    teamPlayers
      .filter((player) => !unavailablePlayerIds.has(player.id))
      .map((player) => player.id),
  );

  const positionsByCode = new Map(positionRows.map((row) => [row.code, row]));

  const { slotRows, assignmentRows } = parseSlotAndAssignmentEntries(formData, {
    inningsCount: parsed.inningsCount,
    validPlayerIds: eligiblePlayerIds,
    positionsByCode,
  });

  await db.transaction(async (tx) => {
    const lineup =
      existingPlan ??
      (
        await tx
          .insert(lineupPlans)
          .values({
            teamId: viewer.teamId,
            eventId: parsed.eventId,
            inningsCount: parsed.inningsCount,
            updatedByUserId: viewer.userId,
          })
          .returning()
      )[0];

    await tx
      .update(lineupPlans)
      .set({
        inningsCount: parsed.inningsCount,
        updatedByUserId: viewer.userId,
        updatedAt: new Date(),
      })
      .where(eq(lineupPlans.id, lineup.id));

    await tx.delete(battingSlots).where(eq(battingSlots.lineupPlanId, lineup.id));
    await tx
      .delete(inningAssignments)
      .where(eq(inningAssignments.lineupPlanId, lineup.id));

    if (slotRows.length > 0) {
      await tx.insert(battingSlots).values(
        slotRows.map((slot) => ({
          lineupPlanId: lineup.id,
          slotNumber: slot.slotNumber,
          playerId: slot.playerId,
        })),
      );
    }

    if (assignmentRows.length > 0) {
      await tx.insert(inningAssignments).values(
        assignmentRows.map((assignment) => ({
          lineupPlanId: lineup.id,
          ...assignment,
        })),
      );
    }
  });

  revalidatePath("/lineups");
  revalidatePath(`/lineups/${parsed.eventId}`);
  redirect(`/events/${parsed.eventId}?saved=lineup`);
}

// ─────────────────────────── Presets ───────────────────────────

const presetSaveSchema = z.object({
  presetId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  inningsCount: z.coerce.number().int().min(1).max(9),
});

const presetDeleteSchema = z.object({
  presetId: z.string().uuid(),
});

/** Shared parser: extract batting slots + inning assignments from form entries
 *  and validate against the team's active position templates. Used by both the
 *  game-event save and the preset save actions. */
function parseSlotAndAssignmentEntries(
  formData: FormData,
  opts: {
    inningsCount: number;
    validPlayerIds: Set<string>;
    positionsByCode: Map<string, { id: string; code: string; label: string }>;
  },
): {
  slotRows: { slotNumber: number; playerId: string }[];
  assignmentRows: AssignmentValue[];
} {
  const slotEntries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith("slot:"),
  );
  const assignmentEntries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith("inning:"),
  );

  const selectedPlayerIds = slotEntries
    .map(([, value]) => String(value))
    .filter(Boolean);
  if (selectedPlayerIds.length !== opts.validPlayerIds.size) {
    throw new Error("Every batting slot must be filled.");
  }
  if (new Set(selectedPlayerIds).size !== selectedPlayerIds.length) {
    throw new Error("Each player can only appear once in the batting order.");
  }
  for (const playerId of selectedPlayerIds) {
    if (!opts.validPlayerIds.has(playerId)) {
      throw new Error("The batting order includes an invalid player.");
    }
  }

  const assignmentRows = assignmentEntries
    .map<AssignmentValue | null>(([key, value]) => {
      const [, inningNumber, playerId] = key.split(":");
      const inningValue = Number(inningNumber);
      if (inningValue > opts.inningsCount) return null;
      if (!opts.validPlayerIds.has(playerId)) {
        throw new Error("The lineup includes an invalid player assignment.");
      }
      const code = String(value);
      const position = opts.positionsByCode.get(code);
      if (!position) {
        throw new Error("Every inning assignment must use an active position.");
      }
      return {
        inningNumber: inningValue,
        playerId,
        positionTemplateId: position.id,
        positionCode: position.code,
        positionLabel: position.label,
      };
    })
    .filter((row): row is AssignmentValue => row !== null);

  return {
    slotRows: slotEntries.map(([key, value]) => ({
      slotNumber: Number(key.split(":")[1]),
      playerId: String(value),
    })),
    assignmentRows,
  };
}

export async function saveLineupPresetAction(formData: FormData) {
  const viewer = await requireLineupManager();
  const parsed = presetSaveSchema.parse({
    presetId: formData.get("presetId") || undefined,
    name: formData.get("name"),
    inningsCount: formData.get("inningsCount"),
  });

  const [teamPlayers, positionRows] = await Promise.all([
    db.query.players.findMany({
      where: eq(players.teamId, viewer.teamId),
      orderBy: [players.lastName, players.firstName],
    }),
    db.query.teamPositionTemplates.findMany({
      where: and(
        eq(teamPositionTemplates.teamId, viewer.teamId),
        eq(teamPositionTemplates.isActive, true),
      ),
    }),
  ]);

  const positionsByCode = new Map(positionRows.map((row) => [row.code, row]));
  const validPlayerIds = new Set(teamPlayers.map((p) => p.id));

  const { slotRows, assignmentRows } = parseSlotAndAssignmentEntries(formData, {
    inningsCount: parsed.inningsCount,
    validPlayerIds,
    positionsByCode,
  });

  let finalPresetId = parsed.presetId;

  await db.transaction(async (tx) => {
    if (finalPresetId) {
      const existing = await tx.query.lineupPresets.findFirst({
        where: and(
          eq(lineupPresets.id, finalPresetId),
          eq(lineupPresets.teamId, viewer.teamId),
        ),
      });
      if (!existing) throw new Error("Preset not found for this team.");
      await tx
        .update(lineupPresets)
        .set({
          name: parsed.name,
          inningsCount: parsed.inningsCount,
          updatedAt: new Date(),
        })
        .where(eq(lineupPresets.id, finalPresetId));
      await tx
        .delete(lineupPresetSlots)
        .where(eq(lineupPresetSlots.presetId, finalPresetId));
      await tx
        .delete(lineupPresetAssignments)
        .where(eq(lineupPresetAssignments.presetId, finalPresetId));
    } else {
      const [created] = await tx
        .insert(lineupPresets)
        .values({
          teamId: viewer.teamId,
          name: parsed.name,
          inningsCount: parsed.inningsCount,
          createdByUserId: viewer.userId,
        })
        .returning();
      finalPresetId = created.id;
    }

    await tx.insert(lineupPresetSlots).values(
      slotRows.map((slot) => ({
        presetId: finalPresetId!,
        slotNumber: slot.slotNumber,
        playerId: slot.playerId,
      })),
    );

    if (assignmentRows.length > 0) {
      await tx.insert(lineupPresetAssignments).values(
        assignmentRows.map((row) => ({
          presetId: finalPresetId!,
          inningNumber: row.inningNumber,
          playerId: row.playerId,
          positionTemplateId: row.positionTemplateId,
          positionCode: row.positionCode,
          positionLabel: row.positionLabel,
        })),
      );
    }
  });

  revalidatePath("/lineups");
  revalidatePath(`/lineups/presets/${finalPresetId}`);
  redirect(`/lineups?saved=preset`);
}

/** Client-callable: fetch a preset's batting order + inning assignments so
 *  the event-lineup editor can apply it to its in-memory state. */
export async function loadLineupPresetPayload(presetId: string) {
  const viewer = await requireLineupManager();
  const preset = await db.query.lineupPresets.findFirst({
    where: and(
      eq(lineupPresets.id, presetId),
      eq(lineupPresets.teamId, viewer.teamId),
    ),
  });
  if (!preset) return null;

  const [slotRows, assignmentRows] = await Promise.all([
    db.query.lineupPresetSlots.findMany({
      where: eq(lineupPresetSlots.presetId, presetId),
    }),
    db.query.lineupPresetAssignments.findMany({
      where: eq(lineupPresetAssignments.presetId, presetId),
    }),
  ]);

  return {
    inningsCount: preset.inningsCount,
    battingOrder: slotRows
      .sort((a, b) => a.slotNumber - b.slotNumber)
      .map((s) => s.playerId),
    assignments: assignmentRows.map((a) => ({
      inningNumber: a.inningNumber,
      playerId: a.playerId,
      positionCode: a.positionCode,
    })),
  };
}

export async function deleteLineupPresetAction(formData: FormData) {
  const viewer = await requireLineupManager();
  const parsed = presetDeleteSchema.parse({
    presetId: formData.get("presetId"),
  });

  const existing = await db.query.lineupPresets.findFirst({
    where: and(
      eq(lineupPresets.id, parsed.presetId),
      eq(lineupPresets.teamId, viewer.teamId),
    ),
  });
  if (!existing) throw new Error("Preset not found for this team.");

  await db.delete(lineupPresets).where(eq(lineupPresets.id, parsed.presetId));

  revalidatePath("/lineups");
  redirect("/lineups?saved=preset-deleted");
}
