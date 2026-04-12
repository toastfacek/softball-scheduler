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

  const [teamPlayers, positionRows, existingPlan] = await Promise.all([
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
  ]);

  const slotEntries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith("slot:"),
  );
  const assignmentEntries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith("inning:"),
  );

  const selectedPlayerIds = slotEntries
    .map(([, value]) => String(value))
    .filter(Boolean);

  if (selectedPlayerIds.length !== teamPlayers.length) {
    throw new Error("Every batting slot must be filled.");
  }

  if (new Set(selectedPlayerIds).size !== selectedPlayerIds.length) {
    throw new Error("Each player can only appear once in the batting order.");
  }

  const validPlayerIds = new Set(teamPlayers.map((player) => player.id));
  for (const playerId of selectedPlayerIds) {
    if (!validPlayerIds.has(playerId)) {
      throw new Error("The batting order includes an invalid player.");
    }
  }

  const positionsByCode = new Map(positionRows.map((row) => [row.code, row]));

  const assignmentValues = assignmentEntries
    .map<AssignmentValue | null>(([key, value]) => {
      const [, inningNumber, playerId] = key.split(":");
      const inningValue = Number(inningNumber);

      if (inningValue > parsed.inningsCount) {
        return null;
      }

      const code = String(value);
      const position = positionsByCode.get(code);

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
    .filter((assignment): assignment is AssignmentValue => assignment !== null);

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

    await tx.insert(battingSlots).values(
      slotEntries.map(([key, value]) => ({
        lineupPlanId: lineup.id,
        slotNumber: Number(key.split(":")[1]),
        playerId: String(value),
      })),
    );

    await tx.insert(inningAssignments).values(
      assignmentValues.map((assignment) => ({
        lineupPlanId: lineup.id,
        ...assignment,
      })),
    );
  });

  revalidatePath("/lineups");
  revalidatePath(`/lineups/${parsed.eventId}`);
  redirect(`/events/${parsed.eventId}?saved=lineup`);
}
