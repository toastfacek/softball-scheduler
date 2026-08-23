import { createHmac } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { golfTournamentInKindAiReviews, golfTournamentInKindSubmissions } from "@/db/schema";
import {
  env,
  isResendConfigured,
  isTurnstileConfigured,
} from "@/lib/env";
import type { GolfEmailResult } from "@/lib/golf-tournament/email";
import { sendLegitimateInKindSubmissionEmail } from "@/lib/golf-tournament/in-kind-notifications";
import { golfTournamentContactEmail } from "@/lib/golf-tournament/event";
import {
  consumeInKindSubmissionRateLimit,
  getClientIp,
} from "@/lib/golf-tournament/in-kind-protection";
import {
  reviewInKindSubmissionWithLlm,
  type InKindLlmReview,
} from "@/lib/golf-tournament/in-kind-llm";
import { routeInKindSubmission } from "@/lib/golf-tournament/in-kind-routing";
import {
  classifyInKindSubmission,
  normalizeInKindText,
  type InKindSubmissionDecision,
} from "@/lib/golf-tournament/in-kind-spam";
import { scheduleGolfTournamentSpreadsheetSync } from "@/lib/golf-tournament/spreadsheet";
import { verifyInKindTurnstileToken } from "@/lib/golf-tournament/turnstile";
import { normalizeEmail } from "@/lib/utils";

export const inKindSubmissionSchema = z.object({
  donorName: z
    .string()
    .trim()
    .min(1, "Donor name is required.")
    .max(120, "Donor name is too long."),
  email: z
    .string()
    .trim()
    .email()
    .max(254, "Please enter a valid email address."),
  description: z
    .string()
    .trim()
    .min(3, "Item description is required.")
    .max(2_000, "Please keep the item description under 2,000 characters."),
  website: z.string().trim().max(200).optional(),
  turnstileToken: z.string().trim().max(2_048).optional(),
});

export type InKindSubmissionRedirectState =
  | "thanks"
  | "verification-failed"
  | "rate-limited"
  | "verification-unavailable"
  | "temporarily-unavailable";

export type InKindSubmissionProcessResult =
  | { kind: "redirect"; redirectState: InKindSubmissionRedirectState }
  | { kind: "invalid" };

type InKindScreeningOutcome =
  | "SPAM"
  | "REVIEW"
  | "CLEAR"
  | "JUDGE_UNAVAILABLE";

type InKindJudgeStatus = "NOT_RUN" | "SUCCEEDED" | "SKIPPED" | "FAILED";

type AuditContext = {
  submissionId: string | null;
  outcome: InKindScreeningOutcome;
  decision: InKindSubmissionDecision;
  llmReview: InKindLlmReview | null;
  inputFingerprint: string;
  emailAttempted?: boolean;
  emailProviderId?: string | null;
  emailError?: string | null;
};

export async function processInKindSubmission({
  formData,
  requestHeaders,
}: {
  formData: FormData;
  requestHeaders: Headers;
}): Promise<InKindSubmissionProcessResult> {
  const parsedResult = inKindSubmissionSchema.safeParse({
    donorName: formValue(formData, "donorName"),
    email: formValue(formData, "email"),
    description: formValue(formData, "description"),
    website: formValue(formData, "website") || undefined,
    turnstileToken: formValue(formData, "cf-turnstile-response") || undefined,
  });

  if (!parsedResult.success) {
    return { kind: "invalid" };
  }

  const parsed = parsedResult.data;

  // Honeypots intentionally look successful to the sender and are not stored.
  if (parsed.website) {
    return redirectResult("thanks");
  }

  const normalizedEmail = normalizeEmail(parsed.email);
  const clientIp = getClientIp(requestHeaders);

  if (!isTurnstileConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return redirectResult("verification-unavailable");
    }
  } else {
    const verification = await verifyInKindTurnstileToken(
      parsed.turnstileToken ?? "",
      clientIp,
    );
    if (!verification.success) {
      return redirectResult("verification-failed");
    }
  }

  const withinRateLimit = await consumeInKindSubmissionRateLimit({
    email: normalizedEmail,
    ip: clientIp,
  });
  if (!withinRateLimit) {
    return redirectResult("rate-limited");
  }

  const priorSubmissions =
    await db.query.golfTournamentInKindSubmissions.findMany({
      where: eq(golfTournamentInKindSubmissions.email, normalizedEmail),
      columns: { itemDescription: true },
    });
  const repeated = priorSubmissions.some(
    ({ itemDescription }) =>
      normalizeInKindText(itemDescription) ===
      normalizeInKindText(parsed.description),
  );

  const decision = classifyInKindSubmission({
    donorName: parsed.donorName,
    email: normalizedEmail,
    itemDescription: parsed.description,
    repeated,
  });
  const inputFingerprint = createInKindInputFingerprint({
    donorName: parsed.donorName,
    email: normalizedEmail,
    itemDescription: parsed.description,
  });

  if (decision.disposition === "DEFINITE_SPAM") {
    await recordInKindScreeningAudit({
      submissionId: null,
      outcome: "SPAM",
      decision,
      llmReview: null,
      inputFingerprint,
    });
    return redirectResult("thanks");
  }

  const llmReview = await reviewInKindSubmissionWithLlm({
    donorName: parsed.donorName,
    email: normalizedEmail,
    itemDescription: parsed.description,
  });
  const routingOutcome = routeInKindSubmission({
    deterministicDisposition: decision.disposition,
    llmReview,
  });

  if (routingOutcome === "JUDGE_UNAVAILABLE") {
    await recordInKindScreeningAudit({
      submissionId: null,
      outcome: "JUDGE_UNAVAILABLE",
      decision,
      llmReview,
      inputFingerprint,
    });
    return redirectResult("temporarily-unavailable");
  }

  if (routingOutcome === "DISCARD") {
    await recordInKindScreeningAudit({
      submissionId: null,
      outcome: "SPAM",
      decision,
      llmReview,
      inputFingerprint,
    });
    return redirectResult("thanks");
  }

  const { auditId } = await createStoredInKindSubmission({
    parsed,
    normalizedEmail,
    decision,
    llmReview,
    outcome: routingOutcome === "EMAIL" ? "CLEAR" : "REVIEW",
    inputFingerprint,
  });

  scheduleGolfTournamentSpreadsheetSync();

  if (routingOutcome === "EMAIL") {
    let emailResult: GolfEmailResult;
    try {
      emailResult = await sendLegitimateInKindSubmissionEmail({
        donorName: parsed.donorName,
        email: normalizedEmail,
        itemDescription: parsed.description,
      });
    } catch (error) {
      console.error("[golf-in-kind] legitimate submission email failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      emailResult = {
        mode: "resend",
        recipients: [golfTournamentContactEmail()],
        providerMessageId: null,
        error: error instanceof Error ? error.message : "Unknown email error.",
      };
    }
    const emailError =
      emailResult.error ??
      (!isResendConfigured()
        ? "RESEND_NOT_CONFIGURED"
        : emailResult.providerMessageId
          ? null
          : "EMAIL_PROVIDER_NO_MESSAGE_ID");

    await db
      .update(golfTournamentInKindAiReviews)
      .set({
        emailAttempted: true,
        emailProviderId: emailResult.providerMessageId,
        emailError,
      })
      .where(eq(golfTournamentInKindAiReviews.id, auditId));
  }

  revalidatePath("/golf-tournament");
  revalidatePath("/golf-admin");
  return redirectResult("thanks");
}

async function createStoredInKindSubmission({
  parsed,
  normalizedEmail,
  decision,
  llmReview,
  outcome,
  inputFingerprint,
}: {
  parsed: z.infer<typeof inKindSubmissionSchema>;
  normalizedEmail: string;
  decision: InKindSubmissionDecision;
  llmReview: InKindLlmReview;
  outcome: Extract<InKindScreeningOutcome, "CLEAR" | "REVIEW">;
  inputFingerprint: string;
}) {
  return db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(golfTournamentInKindSubmissions)
      .values({
        donorName: parsed.donorName,
        contactName: parsed.donorName,
        email: normalizedEmail,
        itemDescription: parsed.description,
        status: outcome === "REVIEW" ? "NEEDS_FOLLOW_UP" : "NEW",
        adminNotes:
          outcome === "REVIEW"
            ? `Automatic review required: ${llmReview.reason}`
            : null,
      })
      .returning({ id: golfTournamentInKindSubmissions.id });

    if (!submission) {
      throw new Error("In-kind submission was not created.");
    }

    const [audit] = await tx
      .insert(golfTournamentInKindAiReviews)
      .values(
        buildInKindAuditValues({
          submissionId: submission.id,
          outcome,
          decision,
          llmReview,
          inputFingerprint,
        }),
      )
      .returning({ id: golfTournamentInKindAiReviews.id });

    if (!audit) {
      throw new Error("In-kind screening audit was not created.");
    }

    return { auditId: audit.id };
  });
}

async function recordInKindScreeningAudit(context: AuditContext) {
  await db.insert(golfTournamentInKindAiReviews).values(
    buildInKindAuditValues(context),
  );
}

function buildInKindAuditValues({
  submissionId,
  outcome,
  decision,
  llmReview,
  inputFingerprint,
  emailAttempted = false,
  emailProviderId = null,
  emailError = null,
}: AuditContext): typeof golfTournamentInKindAiReviews.$inferInsert {
  const trace = llmReview?.trace;
  const judgeStatus: InKindJudgeStatus = llmReview
    ? llmReview.status
    : "NOT_RUN";

  return {
    submissionId,
    verdict: legacyVerdictForOutcome(outcome),
    reason:
      llmReview?.reason ||
      decision.assessment.reasons.join("; ") ||
      "Deterministic screening decision.",
    model:
      trace?.model ??
      (llmReview?.status === "SKIPPED" ? "not-configured" : "deterministic"),
    responseId: trace?.responseId ?? null,
    requestId: trace?.requestId ?? null,
    latencyMs: trace?.latencyMs ?? null,
    inputTokens: trace?.inputTokens ?? null,
    outputTokens: trace?.outputTokens ?? null,
    totalTokens: trace?.totalTokens ?? null,
    httpStatus: trace?.httpStatus ?? null,
    errorCode: trace?.errorCode ?? null,
    screeningOutcome: outcome,
    judgeStatus,
    deterministicScore: decision.assessment.score,
    deterministicReasons: decision.assessment.reasons,
    inputFingerprint,
    attemptCount: trace?.attempts ?? 0,
    emailAttempted,
    emailProviderId,
    emailError,
  };
}

function legacyVerdictForOutcome(
  outcome: InKindScreeningOutcome,
): "PLAUSIBLE" | "SUSPICIOUS" | "UNCERTAIN" {
  switch (outcome) {
    case "CLEAR":
      return "PLAUSIBLE";
    case "SPAM":
      return "SUSPICIOUS";
    case "REVIEW":
    case "JUDGE_UNAVAILABLE":
      return "UNCERTAIN";
  }
}

function createInKindInputFingerprint(input: {
  donorName: string;
  email: string;
  itemDescription: string;
}) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(
      [
        normalizeInKindText(input.donorName),
        normalizeInKindText(input.email),
        normalizeInKindText(input.itemDescription),
      ].join("\u0000"),
    )
    .digest("hex");
}

function redirectResult(
  redirectState: InKindSubmissionRedirectState,
): InKindSubmissionProcessResult {
  return { kind: "redirect", redirectState };
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}
