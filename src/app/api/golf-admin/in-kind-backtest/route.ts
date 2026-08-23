import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { golfTournamentInKindSubmissions } from "@/db/schema";
import { hasGolfAdminSession } from "@/lib/golf-tournament/admin-auth";
import { reviewInKindSubmissionWithLlm } from "@/lib/golf-tournament/in-kind-llm";
import {
  classifyInKindSubmission,
  normalizeInKindText,
} from "@/lib/golf-tournament/in-kind-spam";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REVIEW_CONCURRENCY = 4;

export async function GET(request: Request) {
  if (!(await hasGolfAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (new URL(request.url).searchParams.get("run") !== "1") {
    return NextResponse.json(
      { error: "Pass run=1 to start the read-only backtest." },
      { status: 400 },
    );
  }

  const allSubmissions = await db
    .select({
      id: golfTournamentInKindSubmissions.id,
      donorName: golfTournamentInKindSubmissions.donorName,
      email: golfTournamentInKindSubmissions.email,
      itemDescription: golfTournamentInKindSubmissions.itemDescription,
      status: golfTournamentInKindSubmissions.status,
      createdAt: golfTournamentInKindSubmissions.createdAt,
    })
    .from(golfTournamentInKindSubmissions)
    .orderBy(asc(golfTournamentInKindSubmissions.createdAt));
  const requestedIds = new Set(
    new URL(request.url).searchParams
      .get("ids")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const submissions =
    requestedIds.size > 0
      ? allSubmissions.filter(({ id }) => requestedIds.has(id))
      : allSubmissions;

  const repeatedKeys = new Set(
    submissions
      .map(({ email, itemDescription }) =>
        `${normalizeInKindText(email)}\u0000${normalizeInKindText(itemDescription)}`,
      )
      .filter(
        (key, index, keys) => keys.indexOf(key) !== index,
      ),
  );

  const results = await mapWithConcurrency(
    submissions,
    REVIEW_CONCURRENCY,
    async (submission) => {
      const deterministic = classifyInKindSubmission({
        donorName: submission.donorName,
        email: submission.email,
        itemDescription: submission.itemDescription,
        repeated: repeatedKeys.has(
          `${normalizeInKindText(submission.email)}\u0000${normalizeInKindText(submission.itemDescription)}`,
        ),
      });
      const llm = await reviewInKindSubmissionWithLlm(submission);

      return {
        ...submission,
        deterministic: {
          disposition: deterministic.disposition,
          score: deterministic.assessment.score,
          reasons: deterministic.assessment.reasons,
        },
        llm,
      };
    },
  );

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      total: results.length,
      results,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    }),
  );

  return results;
}
