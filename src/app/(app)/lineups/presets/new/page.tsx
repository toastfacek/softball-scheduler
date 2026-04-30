import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { LineupEditor } from "@/app/(app)/lineups/[eventId]/lineup-editor";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { players, teamPositionTemplates } from "@/db/schema";
import { canManageLineups } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";
import { defaultFieldCodes } from "@/lib/lineup-defaults";
import { fullName } from "@/lib/utils";

export default async function NewPresetPage() {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/sign-in");
  if (!canManageLineups(viewer)) redirect("/lineups");

  const [playerRows, positionRows] = await Promise.all([
    db.query.players.findMany({
      where: eq(players.teamId, viewer.teamId),
      orderBy: [players.lastName, players.firstName],
    }),
    db.query.teamPositionTemplates.findMany({
      where: and(
        eq(teamPositionTemplates.teamId, viewer.teamId),
        eq(teamPositionTemplates.isActive, true),
      ),
      orderBy: [teamPositionTemplates.sortOrder, teamPositionTemplates.label],
    }),
  ]);

  // Default seed: every player in roster order, everyone on BN.
  const inningsCount = 6;
  const fieldCodes = defaultFieldCodes(positionRows);
  const initialBattingOrder = playerRows.map((p) => p.id);
  const initialAssignments: Record<string, string[]> = {};
  for (const [idx, pid] of initialBattingOrder.entries()) {
    initialAssignments[pid] = Array.from({ length: inningsCount }, () =>
      idx < fieldCodes.length ? fieldCodes[idx] : "BN",
    );
  }

  return (
    <>
      <PageHeader title="New preset" back="/lineups" />
      <LineupEditor
        eventTitle="New preset"
        initialInnings={inningsCount}
        initialBattingOrder={initialBattingOrder}
        initialAssignments={initialAssignments}
        players={playerRows.map((p) => ({
          id: p.id,
          name: fullName(p.firstName, p.lastName, p.preferredName),
          availability: null,
        }))}
        positions={positionRows.map((p) => ({ code: p.code, label: p.label }))}
      />
    </>
  );
}
