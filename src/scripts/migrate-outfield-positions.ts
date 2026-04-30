import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { teamPositionTemplates } from "../db/schema";

// One-off: add LCF + RCF to every team so the 4 OF setup is available.
// CF stays active intentionally — existing inning_assignments rows still
// reference position_code = 'CF', and lineup save validates submitted
// codes against the active-template set, so deactivating CF would block
// re-saving any historical lineup until every CF cell is reassigned.
async function main() {
  const allTeams = await db.query.teams.findMany();

  for (const team of allTeams) {
    for (const { code, label, sortOrder } of [
      { code: "LCF", label: "Left Center Field", sortOrder: 75 },
      { code: "RCF", label: "Right Center Field", sortOrder: 85 },
    ]) {
      const existing = await db.query.teamPositionTemplates.findFirst({
        where: and(
          eq(teamPositionTemplates.teamId, team.id),
          eq(teamPositionTemplates.code, code),
        ),
      });
      if (existing) {
        if (!existing.isActive) {
          await db
            .update(teamPositionTemplates)
            .set({ isActive: true, sortOrder, updatedAt: new Date() })
            .where(eq(teamPositionTemplates.id, existing.id));
          console.log(`[${team.slug}] reactivated ${code}`);
        }
      } else {
        await db.insert(teamPositionTemplates).values({
          teamId: team.id,
          code,
          label,
          sortOrder,
          isActive: true,
        });
        console.log(`[${team.slug}] added ${code}`);
      }
    }
  }
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
