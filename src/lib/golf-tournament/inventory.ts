import { and, eq, or } from "drizzle-orm";

import { golfTournamentPurchases } from "@/db/schema";

/**
 * Inventory is claimed by a completed payment or by an offline check that the
 * league has committed to accepting. A pending Stripe checkout does not hold
 * inventory because the buyer may abandon it.
 */
export function golfInventoryCommitmentCondition() {
  return or(
    eq(golfTournamentPurchases.paymentStatus, "PAID"),
    and(
      eq(golfTournamentPurchases.paymentMethod, "CHECK"),
      eq(golfTournamentPurchases.paymentStatus, "PENDING"),
    ),
  );
}
