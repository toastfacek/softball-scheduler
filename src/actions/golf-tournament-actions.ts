"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { z } from "zod";

import { db } from "@/db";
import {
  golfTournamentAssets,
  golfTournamentInKindSubmissions,
  golfTournamentPlayers,
  golfTournamentPurchases,
} from "@/db/schema";
import {
  env,
  isR2Configured,
  isStripeConfigured,
  isTurnstileConfigured,
} from "@/lib/env";
import { sendGolfTournamentEmail } from "@/lib/golf-tournament/email";
import { requireGolfAdmin } from "@/lib/golf-tournament/admin-auth";
import { sendGolfPurchaseConfirmation } from "@/lib/golf-tournament/confirmation-email";
import {
  GOLF_TOURNAMENT_SAFE_PROCEEDS,
  GOLF_TOURNAMENT_TITLE,
  golfTournamentAdminEmails,
  golfTournamentContactEmail,
} from "@/lib/golf-tournament/event";
import {
  consumeInKindSubmissionRateLimit,
  getClientIp,
} from "@/lib/golf-tournament/in-kind-protection";
import { golfInventoryCommitmentCondition } from "@/lib/golf-tournament/inventory";
import { reviewInKindSubmissionWithLlm } from "@/lib/golf-tournament/in-kind-llm";
import {
  classifyInKindSubmission,
  normalizeInKindText,
  scanInKindSubmissions,
} from "@/lib/golf-tournament/in-kind-spam";
import { sendLegitimateInKindSubmissionEmail } from "@/lib/golf-tournament/in-kind-notifications";
import {
  formatGolfPackagePrice,
  getGolfTournamentPackage,
  includedGolfSlotCount,
  isGolfEntryClosedForPackage,
  requiresGolfPlayerNames,
} from "@/lib/golf-tournament/packages";
import { reconcileGolfStripePayments } from "@/lib/golf-tournament/stripe-payments";
import {
  logoObjectKey,
  uploadGolfTournamentLogo,
  validateLogoFile,
} from "@/lib/golf-tournament/storage";
import {
  completionTokenExpiry,
  createCompletionToken,
  hashCompletionToken,
} from "@/lib/golf-tournament/tokens";
import {
  getGolfSpreadsheetSyncErrorInfo,
  scheduleGolfTournamentSpreadsheetSync,
  syncGolfTournamentSpreadsheet,
} from "@/lib/golf-tournament/spreadsheet";
import { verifyInKindTurnstileToken } from "@/lib/golf-tournament/turnstile";
import { normalizeEmail } from "@/lib/utils";

const checkoutSchema = z.object({
  packageId: z.string().trim().min(1),
});

const paymentLinkCheckoutSchema = z.object({
  packageId: z.string().trim().min(1),
  contactName: z.string().trim().optional(),
  businessName: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  phone: z.string().trim().optional(),
  playerNames: z.array(z.string().trim()).length(4),
});

const inKindSchema = z.object({
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

const completionSchema = z.object({
  token: z.string().trim().min(1),
  buyerName: z.string().trim().min(1),
  buyerPhone: z.string().trim().min(1),
  sponsorDisplayName: z.string().trim().optional(),
  sponsorContactName: z.string().trim().optional(),
  sponsorWebsiteUrl: z.string().trim().optional(),
  sponsorRecognitionName: z.string().trim().optional(),
  sponsorNotes: z.string().trim().optional(),
  includedGolfIntent: z
    .enum(["WILL_USE", "WILL_NOT_USE", "NOT_SURE"])
    .optional(),
  playerNames: z.array(z.string().trim()).default([]),
});

const purchaseAdminSchema = z.object({
  purchaseId: z.string().uuid(),
  fulfillmentStatus: z.enum([
    "PAID_NEEDS_DETAILS",
    "DETAILS_SUBMITTED",
    "NEEDS_REVIEW",
    "COMPLETE",
  ]),
  approvedForPublicDisplay: z.boolean().default(false),
});

const inKindAdminSchema = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["NEW", "ACCEPTED", "NEEDS_FOLLOW_UP", "DECLINED"]),
});

const assetAdminSchema = z.object({
  assetId: z.string().uuid(),
  approvedForPublicDisplay: z.boolean().default(false),
});

const uploadLogoSchema = z.object({
  token: z.string().trim().min(1),
});

const resendCompletionLinkSchema = z.object({
  purchaseId: z.string().uuid(),
});

const checkReceiptSchema = z.object({
  purchaseId: z.string().uuid(),
});

export async function createGolfCheckoutSessionAction(formData: FormData) {
  const parsed = checkoutSchema.parse({
    packageId: formData.get("packageId"),
  });
  const packageConfig = getGolfTournamentPackage(parsed.packageId);

  if (!packageConfig) {
    redirect("/golf-tournament?checkout=unavailable");
  }

  if (isGolfEntryClosedForPackage(packageConfig)) {
    redirect("/golf-tournament?checkout=registration-closed");
  }

  if (!isStripeConfigured()) {
    redirect("/golf-tournament?checkout=setup-pending");
  }

  const soldCount = await db.$count(
    golfTournamentPurchases,
    and(
      eq(golfTournamentPurchases.packageId, packageConfig.id),
      golfInventoryCommitmentCondition(),
    ),
  );

  if (packageConfig.capacity !== null && soldCount >= packageConfig.capacity) {
    redirect("/golf-tournament?checkout=sold-out");
  }

  const token = createCompletionToken();
  const [purchase] = await db
    .insert(golfTournamentPurchases)
    .values({
      packageId: packageConfig.id,
      purchaseType: packageConfig.kind,
      amountCents: packageConfig.priceCents,
      completionTokenHash: hashCompletionToken(token),
      completionTokenExpiresAt: completionTokenExpiry(),
    })
    .returning({ id: golfTournamentPurchases.id });

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: {
            name: packageConfig.name,
            description: GOLF_TOURNAMENT_TITLE,
          },
          unit_amount: packageConfig.priceCents,
        },
      },
    ],
    metadata: {
      purchaseId: purchase.id,
      packageId: packageConfig.id,
      completionToken: token,
      includedGolfSlots: String(
        includedGolfSlotCount(packageConfig.includedGolf),
      ),
    },
    success_url: `${appUrl}/golf-tournament/complete/${token}`,
    cancel_url: `${appUrl}/golf-tournament?checkout=cancelled`,
  });

  await db
    .update(golfTournamentPurchases)
    .set({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(golfTournamentPurchases.id, purchase.id));

  scheduleGolfTournamentSpreadsheetSync();

  if (!session.url) {
    redirect("/golf-tournament?checkout=setup-pending");
  }

  redirect(session.url);
}

export async function startGolfPaymentLinkCheckoutAction(formData: FormData) {
  const parsed = paymentLinkCheckoutSchema.parse({
    packageId: formData.get("packageId"),
    contactName: formData.get("contactName")?.toString(),
    businessName: formData.get("businessName")?.toString(),
    email: formData.get("email")?.toString(),
    phone: formData.get("phone")?.toString(),
    playerNames: [1, 2, 3, 4].map(
      (slotNumber) => formData.get(`player${slotNumber}`)?.toString() ?? "",
    ),
  });
  const packageConfig = getGolfTournamentPackage(parsed.packageId);
  const includedPlayerCount = packageConfig
    ? includedGolfSlotCount(packageConfig.includedGolf)
    : 0;

  if (
    !packageConfig?.checkoutUrl ||
    (packageConfig.kind !== "SPONSORSHIP" && includedPlayerCount === 0)
  ) {
    redirect("/golf-tournament?checkout=unavailable");
  }

  if (isGolfEntryClosedForPackage(packageConfig)) {
    redirect("/golf-tournament?checkout=registration-closed");
  }

  const requiresPlayerNames = requiresGolfPlayerNames(packageConfig);
  if (
    requiresPlayerNames &&
    parsed.playerNames
      .slice(0, includedPlayerCount)
      .some((playerName) => !playerName)
  ) {
    redirect("/golf-tournament?checkout=unavailable");
  }

  const soldCount = await db.$count(
    golfTournamentPurchases,
    and(
      eq(golfTournamentPurchases.packageId, packageConfig.id),
      golfInventoryCommitmentCondition(),
    ),
  );

  if (packageConfig.capacity !== null && soldCount >= packageConfig.capacity) {
    redirect("/golf-tournament?checkout=sold-out");
  }

  const token = createCompletionToken();
  const purchase = await db.transaction(async (tx) => {
    const [createdPurchase] = await tx
      .insert(golfTournamentPurchases)
      .values({
        packageId: packageConfig.id,
        purchaseType: packageConfig.kind,
        amountCents: packageConfig.priceCents,
        buyerName: parsed.contactName || null,
        buyerEmail: parsed.email || null,
        buyerPhone: parsed.phone || null,
        sponsorDisplayName: parsed.businessName || null,
        sponsorContactName: parsed.contactName || null,
        completionTokenHash: hashCompletionToken(token),
        completionTokenExpiresAt: completionTokenExpiry(),
      })
      .returning({ id: golfTournamentPurchases.id });

    if (requiresPlayerNames) {
      await tx.insert(golfTournamentPlayers).values(
        parsed.playerNames.slice(0, includedPlayerCount).map((name, index) => ({
          purchaseId: createdPurchase.id,
          slotNumber: index + 1,
          name,
        })),
      );
    }

    return createdPurchase;
  });

  scheduleGolfTournamentSpreadsheetSync();

  const checkoutUrl = new URL(packageConfig.checkoutUrl);
  checkoutUrl.searchParams.set("client_reference_id", purchase.id);
  if (parsed.email) {
    checkoutUrl.searchParams.set("prefilled_email", parsed.email);
  }
  redirect(checkoutUrl.toString());
}

export async function submitGolfInKindDonationAction(formData: FormData) {
  const parsed = inKindSchema.parse({
    donorName: formData.get("donorName"),
    email: formData.get("email"),
    description: formData.get("description"),
    website: formData.get("website") || undefined,
    turnstileToken: formData.get("cf-turnstile-response") || undefined,
  });

  // Honeypots are intentionally handled as a successful no-op so simple bots
  // do not learn which field identified them.
  if (parsed.website) {
    redirect("/golf-tournament?inKind=thanks");
  }

  const normalizedEmail = normalizeEmail(parsed.email);
  const requestHeaders = await headers();
  const clientIp = getClientIp(requestHeaders);

  if (!isTurnstileConfigured()) {
    if (process.env.NODE_ENV === "production") {
      redirect("/golf-tournament?inKind=verification-unavailable");
    }
  } else {
    const verification = await verifyInKindTurnstileToken(
      parsed.turnstileToken ?? "",
      clientIp,
    );
    if (!verification.success) {
      redirect("/golf-tournament?inKind=verification-failed");
    }
  }

  const withinRateLimit = await consumeInKindSubmissionRateLimit({
    email: normalizedEmail,
    ip: clientIp,
  });
  if (!withinRateLimit) {
    redirect("/golf-tournament?inKind=rate-limited");
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
  const llmReview =
    decision.disposition === "FORWARD_TO_MICHELLE"
      ? await reviewInKindSubmissionWithLlm({
          donorName: parsed.donorName,
          email: normalizedEmail,
          itemDescription: parsed.description,
        })
      : null;
  const llmFlagsForReview =
    llmReview?.verdict === "SUSPICIOUS" ||
    llmReview?.verdict === "UNCERTAIN";
  const shouldFlagForDiscardReview =
    decision.disposition === "FLAG_FOR_DISCARD" || llmFlagsForReview;
  const automaticReviewReasons = [
    ...decision.assessment.reasons,
    ...(llmFlagsForReview && llmReview
      ? [`AI review (${llmReview.verdict.toLowerCase()}): ${llmReview.reason}`]
      : []),
  ];

  await db.insert(golfTournamentInKindSubmissions).values({
    donorName: parsed.donorName,
    contactName: parsed.donorName,
    email: normalizedEmail,
    itemDescription: parsed.description,
    status: shouldFlagForDiscardReview ? "NEEDS_FOLLOW_UP" : "NEW",
    adminNotes: shouldFlagForDiscardReview
      ? `Automatic discard review: ${automaticReviewReasons.join("; ")}.`
      : null,
  });

  scheduleGolfTournamentSpreadsheetSync();

  if (
    decision.disposition === "FORWARD_TO_MICHELLE" &&
    !llmFlagsForReview
  ) {
    await sendLegitimateInKindSubmissionEmail({
      donorName: parsed.donorName,
      email: normalizedEmail,
      itemDescription: parsed.description,
    });
  }

  revalidatePath("/golf-tournament");
  revalidatePath("/golf-admin");
  redirect("/golf-tournament?inKind=thanks");
}

export async function updateGolfCompletionAction(formData: FormData) {
  const parsed = completionSchema.parse({
    token: formData.get("token"),
    buyerName: formData.get("buyerName"),
    buyerPhone: formData.get("buyerPhone"),
    sponsorDisplayName: formData.get("sponsorDisplayName") || undefined,
    sponsorContactName: formData.get("sponsorContactName") || undefined,
    sponsorWebsiteUrl: formData.get("sponsorWebsiteUrl") || undefined,
    sponsorRecognitionName: formData.get("sponsorRecognitionName") || undefined,
    sponsorNotes: formData.get("sponsorNotes") || undefined,
    includedGolfIntent: formData.get("includedGolfIntent") || undefined,
    playerNames: [1, 2, 3, 4].map(
      (slotNumber) => formData.get(`player${slotNumber}`)?.toString() ?? "",
    ),
  });

  const tokenHash = hashCompletionToken(parsed.token);
  const now = new Date();

  const existingPurchase = await db.query.golfTournamentPurchases.findFirst({
    where: eq(golfTournamentPurchases.completionTokenHash, tokenHash),
  });

  if (
    !existingPurchase ||
    existingPurchase.completionTokenRevokedAt ||
    (existingPurchase.completionTokenExpiresAt &&
      existingPurchase.completionTokenExpiresAt < now)
  ) {
    redirect("/golf-tournament?checkout=unavailable");
  }

  const packageConfig = getGolfTournamentPackage(existingPurchase.packageId);
  const existingPlayers = await db.query.golfTournamentPlayers.findMany({
    where: (table, { eq }) => eq(table.purchaseId, existingPurchase.id),
  });
  const includedPlayerCount = Math.max(
    packageConfig ? includedGolfSlotCount(packageConfig.includedGolf) : 0,
    existingPlayers.length,
  );
  if (
    packageConfig?.kind === "GOLF" &&
    parsed.playerNames
      .slice(0, includedPlayerCount)
      .some((name) => name.length === 0)
  ) {
    redirect(
      `/golf-tournament/complete/${parsed.token}?details=player-names`,
    );
  }

  const [purchase] = await db
    .update(golfTournamentPurchases)
    .set({
      buyerName: parsed.buyerName,
      buyerPhone: parsed.buyerPhone,
      sponsorDisplayName: parsed.sponsorDisplayName || null,
      sponsorContactName: parsed.sponsorContactName || null,
      sponsorWebsiteUrl: parsed.sponsorWebsiteUrl || null,
      sponsorRecognitionName: parsed.sponsorRecognitionName || null,
      sponsorNotes: parsed.sponsorNotes || null,
      includedGolfIntent: parsed.includedGolfIntent ?? null,
      fulfillmentStatus: "DETAILS_SUBMITTED",
      detailsSubmittedAt: now,
      updatedAt: now,
    })
    .where(eq(golfTournamentPurchases.id, existingPurchase.id))
    .returning({ id: golfTournamentPurchases.id });

  if (!purchase) {
    redirect("/golf-tournament?checkout=unavailable");
  }

  await Promise.all(
    parsed.playerNames.slice(0, includedPlayerCount).map((name, index) =>
      db
        .insert(golfTournamentPlayers)
        .values({
          purchaseId: purchase.id,
          slotNumber: index + 1,
          name: name || null,
        })
        .onConflictDoUpdate({
          target: [
            golfTournamentPlayers.purchaseId,
            golfTournamentPlayers.slotNumber,
          ],
          set: {
            name: name || null,
            updatedAt: now,
          },
        }),
    ),
  );

  scheduleGolfTournamentSpreadsheetSync();

  revalidatePath(`/golf-tournament/complete/${parsed.token}`);

  await sendGolfTournamentEmail({
    to: golfTournamentAdminEmails(),
    subject: "BGSL golf tournament details updated",
    body: [
      "A buyer updated their tournament details.",
      "",
      `Contact: ${parsed.buyerName}`,
      `Phone: ${parsed.buyerPhone}`,
      parsed.sponsorDisplayName
        ? `Sponsor: ${parsed.sponsorDisplayName}`
        : null,
      "",
      `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/golf-admin`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  redirect(`/golf-tournament/complete/${parsed.token}?saved=1`);
}

export async function uploadGolfLogoAction(formData: FormData) {
  const parsed = uploadLogoSchema.parse({
    token: formData.get("token"),
  });
  const file = formData.get("logo");

  if (!(file instanceof File)) {
    redirect(`/golf-tournament/complete/${parsed.token}?upload=missing`);
  }

  const validationError = validateLogoFile(file);
  if (validationError) {
    redirect(`/golf-tournament/complete/${parsed.token}?upload=invalid`);
  }

  if (!isR2Configured()) {
    redirect(`/golf-tournament/complete/${parsed.token}?upload=setup-pending`);
  }

  const tokenHash = hashCompletionToken(parsed.token);
  const purchase = await db.query.golfTournamentPurchases.findFirst({
    where: eq(golfTournamentPurchases.completionTokenHash, tokenHash),
  });

  if (
    !purchase ||
    purchase.paymentStatus !== "PAID" ||
    purchase.completionTokenRevokedAt ||
    (purchase.completionTokenExpiresAt &&
      purchase.completionTokenExpiresAt < new Date())
  ) {
    redirect(`/golf-tournament/complete/${parsed.token}?upload=unavailable`);
  }

  const key = logoObjectKey({
    purchaseId: purchase.id,
    filename: file.name,
  });

  await uploadGolfTournamentLogo({ key, file });

  await db
    .insert(golfTournamentAssets)
    .values({
      purchaseId: purchase.id,
      kind: "LOGO",
      r2Key: key,
      originalFilename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    })
    .onConflictDoUpdate({
      target: golfTournamentAssets.r2Key,
      set: {
        originalFilename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        approvedForPublicDisplay: false,
        approvedPublicDisplayAt: null,
        updatedAt: new Date(),
      },
    });

  await db
    .update(golfTournamentPurchases)
    .set({
      fulfillmentStatus: "NEEDS_REVIEW",
      updatedAt: new Date(),
    })
    .where(eq(golfTournamentPurchases.id, purchase.id));

  scheduleGolfTournamentSpreadsheetSync();

  await sendGolfTournamentEmail({
    to: golfTournamentAdminEmails(),
    subject: "BGSL golf sponsor logo uploaded",
    body: [
      "A sponsor uploaded a logo or artwork file for review.",
      "",
      `Package: ${getGolfTournamentPackage(purchase.packageId)?.name ?? purchase.packageId}`,
      `Sponsor: ${purchase.sponsorDisplayName ?? purchase.buyerName ?? "Unknown"}`,
      `File: ${file.name}`,
      "",
      `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/golf-admin`,
    ].join("\n"),
  });

  revalidatePath(`/golf-tournament/complete/${parsed.token}`);
  revalidatePath("/golf-admin");
  redirect(`/golf-tournament/complete/${parsed.token}?upload=success`);
}

export async function updateGolfPurchaseAdminAction(formData: FormData) {
  await requireGolfAdmin();
  const parsed = purchaseAdminSchema.parse({
    purchaseId: formData.get("purchaseId"),
    fulfillmentStatus: formData.get("fulfillmentStatus"),
    approvedForPublicDisplay: formData.get("approvedForPublicDisplay") === "on",
  });
  const now = new Date();

  await db
    .update(golfTournamentPurchases)
    .set({
      fulfillmentStatus: parsed.fulfillmentStatus,
      approvedForPublicDisplay: parsed.approvedForPublicDisplay,
      approvedPublicDisplayAt: parsed.approvedForPublicDisplay ? now : null,
      updatedAt: now,
    })
    .where(eq(golfTournamentPurchases.id, parsed.purchaseId));

  scheduleGolfTournamentSpreadsheetSync();

  revalidatePath("/golf-admin");
  revalidatePath("/golf-tournament");
  redirect("/golf-admin?saved=purchase");
}

export async function reconcileGolfStripePaymentsAction() {
  await requireGolfAdmin();

  if (!isStripeConfigured()) {
    redirect("/golf-admin?sync=not-configured");
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  let result;

  try {
    result = await reconcileGolfStripePayments(stripe);
  } catch (error) {
    console.error("[stripe:golf] reconciliation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    redirect("/golf-admin?sync=failed");
  }

  scheduleGolfTournamentSpreadsheetSync();

  revalidatePath("/golf-admin");
  revalidatePath("/golf-tournament");

  const query = new URLSearchParams({
    sync: "success",
    imported: String(result.importedPurchases),
    updated: String(result.updatedPurchases),
    existing: String(result.existingPurchases),
    scanned: String(result.scannedSessions),
    links: String(result.matchedLinks),
    configuredLinks: String(result.configuredLinks),
    failed: String(result.failedSessions),
  });
  redirect(`/golf-admin?${query.toString()}`);
}

export async function updateGolfInKindStatusAction(formData: FormData) {
  await requireGolfAdmin();
  const parsed = inKindAdminSchema.parse({
    submissionId: formData.get("submissionId"),
    status: formData.get("status"),
  });

  const submission = await db.query.golfTournamentInKindSubmissions.findFirst({
    where: eq(golfTournamentInKindSubmissions.id, parsed.submissionId),
  });

  await db
    .update(golfTournamentInKindSubmissions)
    .set({
      status: parsed.status,
      updatedAt: new Date(),
    })
    .where(eq(golfTournamentInKindSubmissions.id, parsed.submissionId));

  if (parsed.status === "ACCEPTED" && submission && !submission.acceptedEmailSentAt) {
    const emailResult = await sendGolfTournamentEmail({
      to: [submission.email],
      subject: "BGSL accepted your raffle donation idea",
      body: [
        `Thanks for supporting ${GOLF_TOURNAMENT_TITLE}, ${submission.donorName}.`,
        "",
        "BGSL accepted your raffle or in-kind donation idea. We’ll follow up directly about pickup or drop-off details.",
        "",
        `Submitted item: ${submission.itemDescription}`,
        "",
        GOLF_TOURNAMENT_SAFE_PROCEEDS,
      ].join("\n"),
    });

    const emailFailed =
      emailResult && "error" in emailResult && Boolean(emailResult.error);
    if (emailFailed) {
      console.error("[golf-email] accepted in-kind email failed", {
        submissionId: submission.id,
        error: emailResult.error,
      });
    } else {
      await db
        .update(golfTournamentInKindSubmissions)
        .set({ acceptedEmailSentAt: new Date(), updatedAt: new Date() })
        .where(eq(golfTournamentInKindSubmissions.id, submission.id));
    }
  }

  scheduleGolfTournamentSpreadsheetSync();

  revalidatePath("/golf-admin");
  redirect("/golf-admin?saved=in-kind");
}

export async function flagSuspiciousGolfInKindSubmissionsAction() {
  await requireGolfAdmin();

  const submissions =
    await db.query.golfTournamentInKindSubmissions.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
  const candidates = scanInKindSubmissions(submissions);
  const flaggableCandidates = candidates.filter(
    (candidate) => candidate.eligibleForFlag,
  );

  if (flaggableCandidates.length > 0) {
    await db.transaction(async (tx) => {
      for (const candidate of flaggableCandidates) {
        const existingNotes = candidate.submission.adminNotes?.trim();
        const scanNote = `Automatic cleanup review: ${candidate.reasons.join(
          "; ",
        )}.`;

        await tx
          .update(golfTournamentInKindSubmissions)
          .set({
            status: "NEEDS_FOLLOW_UP",
            adminNotes: [existingNotes, scanNote]
              .filter(Boolean)
              .join("\n"),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(golfTournamentInKindSubmissions.id, candidate.submission.id),
              eq(golfTournamentInKindSubmissions.status, "NEW"),
            ),
          );
      }
    });

    scheduleGolfTournamentSpreadsheetSync();
  }

  revalidatePath("/golf-admin");
  redirect(
    `/golf-admin?scan=${flaggableCandidates.length > 0 ? "flagged" : "none"}&flagged=${flaggableCandidates.length}&candidates=${candidates.length}`,
  );
}

export async function updateGolfAssetAdminAction(formData: FormData) {
  await requireGolfAdmin();
  const parsed = assetAdminSchema.parse({
    assetId: formData.get("assetId"),
    approvedForPublicDisplay: formData.get("approvedForPublicDisplay") === "on",
  });
  const now = new Date();

  await db
    .update(golfTournamentAssets)
    .set({
      approvedForPublicDisplay: parsed.approvedForPublicDisplay,
      approvedPublicDisplayAt: parsed.approvedForPublicDisplay ? now : null,
      updatedAt: now,
    })
    .where(eq(golfTournamentAssets.id, parsed.assetId));

  scheduleGolfTournamentSpreadsheetSync();

  revalidatePath("/golf-admin");
  revalidatePath("/golf-tournament");
  redirect("/golf-admin?saved=asset");
}

export async function resendGolfCompletionLinkAction(formData: FormData) {
  await requireGolfAdmin();
  const parsed = resendCompletionLinkSchema.parse({
    purchaseId: formData.get("purchaseId"),
  });

  const existing = await db.query.golfTournamentPurchases.findFirst({
    where: eq(golfTournamentPurchases.id, parsed.purchaseId),
  });

  if (!existing?.buyerEmail) {
    redirect("/golf-admin?saved=missing-email");
  }
  const buyerEmail = existing.buyerEmail;

  const token = createCompletionToken();
  const tokenHash = hashCompletionToken(token);

  const [purchase] = await db
    .update(golfTournamentPurchases)
    .set({
      completionTokenHash: tokenHash,
      completionTokenExpiresAt: completionTokenExpiry(),
      completionTokenRevokedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(golfTournamentPurchases.id, parsed.purchaseId))
    .returning();

  if (!purchase) {
    redirect("/golf-admin?saved=missing-email");
  }

  const packageConfig = getGolfTournamentPackage(purchase.packageId);
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const completionUrl = `${appUrl}/golf-tournament/complete/${token}`;
  const contactEmail = golfTournamentContactEmail();

  await sendGolfTournamentEmail({
    to: [buyerEmail],
    subject: "Your BGSL golf tournament completion link",
    body: [
      `Thanks again for supporting ${GOLF_TOURNAMENT_TITLE}.`,
      "",
      `Package: ${packageConfig?.name ?? purchase.packageId}`,
      `Amount paid: ${formatGolfPackagePrice(purchase.amountCents)}`,
      "",
      "Use this private link to add or update player names, sponsor details, and logo/artwork:",
      completionUrl,
      "",
      contactEmail ? `Questions? Email ${contactEmail}.` : null,
      "",
      GOLF_TOURNAMENT_SAFE_PROCEEDS,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  redirect("/golf-admin?saved=resent");
}

export async function revokeGolfCompletionLinkAction(formData: FormData) {
  await requireGolfAdmin();
  const parsed = resendCompletionLinkSchema.parse({
    purchaseId: formData.get("purchaseId"),
  });

  await db
    .update(golfTournamentPurchases)
    .set({
      completionTokenRevokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(golfTournamentPurchases.id, parsed.purchaseId));

  redirect("/golf-admin?saved=revoked");
}

export async function resendGolfConfirmationAction(formData: FormData) {
  await requireGolfAdmin();
  const parsed = resendCompletionLinkSchema.parse({
    purchaseId: formData.get("purchaseId"),
  });

  try {
    const result = await sendGolfPurchaseConfirmation(parsed.purchaseId, {
      force: true,
    });

    revalidatePath("/golf-admin");
    redirect(`/golf-admin?saved=confirmation-${result.status}`);
  } finally {
    scheduleGolfTournamentSpreadsheetSync();
  }
}

export async function syncGolfTournamentSpreadsheetAction() {
  await requireGolfAdmin();

  let result;
  try {
    result = await syncGolfTournamentSpreadsheet();
  } catch (error) {
    const errorInfo = getGolfSpreadsheetSyncErrorInfo(error);
    console.error("[golf-sheet] manual sync failed", errorInfo);
    redirect(`/golf-admin?sheetSync=failed&reason=${errorInfo.code}`);
  }

  const query = new URLSearchParams({
    sheetSync: "success",
    rows: String(result.rowCount),
    tabs: String(result.sheetCount),
  });
  redirect(`/golf-admin?${query.toString()}`);
}

export async function markGolfCheckReceivedAction(formData: FormData) {
  await requireGolfAdmin();
  const parsed = checkReceiptSchema.parse({
    purchaseId: formData.get("purchaseId"),
  });

  const [purchase] = await db
    .update(golfTournamentPurchases)
    .set({
      paymentStatus: "PAID",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(golfTournamentPurchases.id, parsed.purchaseId),
        eq(golfTournamentPurchases.paymentMethod, "CHECK"),
        eq(golfTournamentPurchases.paymentStatus, "PENDING"),
      ),
    )
    .returning({ id: golfTournamentPurchases.id });

  if (!purchase) {
    redirect("/golf-admin?saved=check-unavailable");
  }

  scheduleGolfTournamentSpreadsheetSync();

  revalidatePath("/golf-admin");
  revalidatePath("/golf-tournament");
  redirect("/golf-admin?saved=check-received");
}
