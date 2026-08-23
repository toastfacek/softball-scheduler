import { and, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  golfInKindScreeningOutcomeEnum,
  golfTournamentInKindAiReviews,
} from "@/db/schema";

export type InKindScreeningOutcome =
  (typeof golfInKindScreeningOutcomeEnum.enumValues)[number];

const SPAM_QUARANTINE_RETENTION_MS = 14 * 24 * 60 * 60 * 1_000;
const JUDGE_FAILURE_RETENTION_MS = 24 * 60 * 60 * 1_000;

export function inKindQuarantineExpiry(
  outcome: InKindScreeningOutcome,
  now = new Date(),
) {
  if (outcome === "SPAM") {
    return new Date(now.getTime() + SPAM_QUARANTINE_RETENTION_MS);
  }

  if (outcome === "JUDGE_UNAVAILABLE") {
    return new Date(now.getTime() + JUDGE_FAILURE_RETENTION_MS);
  }

  return null;
}

export async function purgeExpiredInKindQuarantine(now = new Date()) {
  const result = await db
    .delete(golfTournamentInKindAiReviews)
    .where(
      and(
        isNotNull(golfTournamentInKindAiReviews.quarantineUntil),
        lte(golfTournamentInKindAiReviews.quarantineUntil, now),
      ),
    )
    .returning({ id: golfTournamentInKindAiReviews.id });

  return result.length;
}
