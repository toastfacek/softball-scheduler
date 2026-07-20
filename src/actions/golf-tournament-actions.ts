"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
import { env, isR2Configured, isStripeConfigured } from "@/lib/env";
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
  formatGolfPackagePrice,
  getGolfTournamentPackage,
  includedGolfSlotCount,
} from "@/lib/golf-tournament/packages";
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
  donorName: z.string().trim().min(1, "Donor name is required."),
  email: z.string().email(),
  description: z.string().trim().min(3, "Item description is required."),
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

export async function createGolfCheckoutSessionAction(formData: FormData) {
  const parsed = checkoutSchema.parse({
    packageId: formData.get("packageId"),
  });
  const packageConfig = getGolfTournamentPackage(parsed.packageId);

  if (!packageConfig) {
    redirect("/golf-tournament?checkout=unavailable");
  }

  if (!isStripeConfigured()) {
    redirect("/golf-tournament?checkout=setup-pending");
  }

  const soldCount = await db.$count(
    golfTournamentPurchases,
    and(
      eq(golfTournamentPurchases.packageId, packageConfig.id),
      eq(golfTournamentPurchases.paymentStatus, "PAID"),
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

  if (
    !packageConfig?.checkoutUrl ||
    (packageConfig.kind !== "SPONSORSHIP" &&
      includedGolfSlotCount(packageConfig.includedGolf) !== 4)
  ) {
    redirect("/golf-tournament?checkout=unavailable");
  }

  const requiresFoursomeNames =
    includedGolfSlotCount(packageConfig.includedGolf) === 4;
  if (
    requiresFoursomeNames &&
    parsed.playerNames.some((playerName) => !playerName)
  ) {
    redirect("/golf-tournament?checkout=unavailable");
  }

  const soldCount = await db.$count(
    golfTournamentPurchases,
    and(
      eq(golfTournamentPurchases.packageId, packageConfig.id),
      eq(golfTournamentPurchases.paymentStatus, "PAID"),
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

    if (requiresFoursomeNames) {
      await tx.insert(golfTournamentPlayers).values(
        parsed.playerNames.map((name, index) => ({
          purchaseId: createdPurchase.id,
          slotNumber: index + 1,
          name,
        })),
      );
    }

    return createdPurchase;
  });

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
  });

  await db.insert(golfTournamentInKindSubmissions).values({
    donorName: parsed.donorName,
    contactName: parsed.donorName,
    email: parsed.email,
    itemDescription: parsed.description,
  });

  await sendGolfTournamentEmail({
    to: [parsed.email],
    subject: "BGSL received your raffle donation idea",
    body: [
      `Thanks for supporting ${GOLF_TOURNAMENT_TITLE}, ${parsed.donorName}.`,
      "",
      "We received your raffle or in-kind donation submission and will follow up about pickup or drop-off details.",
      "",
      `Submitted item: ${parsed.description}`,
      "",
      GOLF_TOURNAMENT_SAFE_PROCEEDS,
    ].join("\n"),
  });

  await sendGolfTournamentEmail({
    to: golfTournamentAdminEmails(),
    subject: "New BGSL golf raffle/in-kind submission",
    body: [
      "A new raffle or in-kind donation was submitted.",
      "",
      `Donor: ${parsed.donorName}`,
      `Email: ${parsed.email}`,
      `Item: ${parsed.description}`,
      "",
      `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/golf-admin`,
    ].join("\n"),
  });

  revalidatePath("/golf-tournament");
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
  if (
    packageConfig?.kind === "GOLF" &&
    parsed.playerNames.slice(0, 4).some((name) => name.length === 0)
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
    parsed.playerNames.map((name, index) =>
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

  revalidatePath("/golf-admin");
  revalidatePath("/golf-tournament");
  redirect("/golf-admin?saved=purchase");
}

export async function updateGolfInKindStatusAction(formData: FormData) {
  await requireGolfAdmin();
  const parsed = inKindAdminSchema.parse({
    submissionId: formData.get("submissionId"),
    status: formData.get("status"),
  });

  await db
    .update(golfTournamentInKindSubmissions)
    .set({
      status: parsed.status,
      updatedAt: new Date(),
    })
    .where(eq(golfTournamentInKindSubmissions.id, parsed.submissionId));

  revalidatePath("/golf-admin");
  redirect("/golf-admin?saved=in-kind");
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
  const result = await sendGolfPurchaseConfirmation(parsed.purchaseId, {
    force: true,
  });

  revalidatePath("/golf-admin");
  redirect(`/golf-admin?saved=confirmation-${result.status}`);
}
