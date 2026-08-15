import { createHmac } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { golfTournamentInKindSubmissionRateLimits } from "@/db/schema";
import { env } from "@/lib/env";
import { normalizeEmail } from "@/lib/utils";

const RATE_LIMITS = [
  { scope: "ip", limit: 5, windowMs: 10 * 60 * 1000 },
  { scope: "email", limit: 2, windowMs: 24 * 60 * 60 * 1000 },
] as const;

export function getClientIp(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",", 1)[0]?.trim();

  return (
    forwardedIp ||
    requestHeaders.get("x-real-ip")?.trim() ||
    requestHeaders.get("cf-connecting-ip")?.trim() ||
    null
  );
}

export async function consumeInKindSubmissionRateLimit({
  email,
  ip,
}: {
  email: string;
  ip?: string | null;
}) {
  const keys = [
    { scope: "email", value: normalizeEmail(email) },
    ...(ip ? [{ scope: "ip", value: ip }] : []),
  ];

  for (const config of RATE_LIMITS) {
    const key = keys.find((candidate) => candidate.scope === config.scope);
    if (!key) continue;

    const allowed = await consumeRateLimitKey({
      ...config,
      key: `${key.scope}:${key.value}`,
    });
    if (!allowed) return false;
  }

  return true;
}

async function consumeRateLimitKey({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const keyHash = createHmac("sha256", env.AUTH_SECRET)
    .update(key)
    .digest("hex");
  const table = golfTournamentInKindSubmissionRateLimits;

  const [record] = await db
    .insert(table)
    .values({
      keyHash,
      windowStartedAt: now,
      requestCount: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: table.keyHash,
      set: {
        windowStartedAt: sql`CASE
          WHEN ${table.windowStartedAt} <= ${windowStart} THEN ${now}
          ELSE ${table.windowStartedAt}
        END`,
        requestCount: sql`CASE
          WHEN ${table.windowStartedAt} <= ${windowStart} THEN 1
          WHEN ${table.requestCount} < ${limit} THEN ${table.requestCount} + 1
          ELSE ${table.requestCount}
        END`,
        updatedAt: now,
      },
    })
    .returning({ requestCount: table.requestCount });

  return (record?.requestCount ?? limit + 1) <= limit;
}
