import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { teamPositionTemplates } from "../db/schema";

// One-off: switch every team from a single CF to LCF + RCF (4 OF setup).
// Existing inning_assignments rows preserve `position_code = 'CF'` even if
// the template is deactivated — the FK is ON DELETE SET NULL by default and
// we only flip is_active here, so historical lineups stay readable.
async function main() {
  const allTeams = await db.query.teams.findMany();

  for (const team of allTeams) {
    const cf = await db.query.teamPositionTemplates.findFirst({
      where: and(
        eq(teamPositionTemplates.teamId, team.id),
        eq(teamPositionTemplates.code, "CF"),
      ),
    });
    if (cf?.isActive) {
      await db
        .update(teamPositionTemplates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(teamPositionTemplates.id, cf.id));
      console.log(`[${team.slug}] deactivated CF`);
    }

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
