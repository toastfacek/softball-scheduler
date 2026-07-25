import { eq, or } from "drizzle-orm";
import Stripe from "stripe";

import { db } from "@/db";
import {
  golfTournamentPlayers,
  golfTournamentPurchases,
} from "@/db/schema";
import { env } from "@/lib/env";
import { sendGolfPurchaseConfirmation } from "@/lib/golf-tournament/confirmation-email";
import { sendGolfTournamentEmail } from "@/lib/golf-tournament/email";
import { golfTournamentAdminEmails } from "@/lib/golf-tournament/event";
import {
  type GolfTournamentPackage,
  formatGolfPackagePrice,
  getGolfTournamentPackage,
  golfTournamentPackages,
  includedGolfSlotCount,
} from "@/lib/golf-tournament/packages";
import {
  completionTokenExpiry,
  createCompletionToken,
  hashCompletionToken,
} from "@/lib/golf-tournament/tokens";

const RECONCILIATION_START = Math.floor(
  new Date("2026-06-01T00:00:00-04:00").getTime() / 1000,
);

type PaymentLinkPackageCache = Map<string, GolfTournamentPackage | null>;

export type GolfStripeRecordingResult =
  | {
      status: "recorded" | "updated" | "already-recorded";
      purchaseId: string;
      packageId: string;
    }
  | {
      status: "ignored";
      reason: "not-paid" | "not-bgsl-golf";
    };

export type GolfStripeReconciliationResult = {
  configuredLinks: number;
  matchedLinks: number;
  scannedSessions: number;
  importedPurchases: number;
  updatedPurchases: number;
  existingPurchases: number;
  ignoredSessions: number;
  failedSessions: number;
};

export async function recordGolfCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  options: {
    sendNotifications?: boolean;
    paymentLinkPackageCache?: PaymentLinkPackageCache;
  } = {},
): Promise<GolfStripeRecordingResult> {
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return { status: "ignored", reason: "not-paid" };
  }

  const paymentIntentId = stripeObjectId(session.payment_intent);
  const existingByStripeReference =
    await db.query.golfTournamentPurchases.findFirst({
      where: or(
        eq(golfTournamentPurchases.stripeCheckoutSessionId, session.id),
        ...(paymentIntentId
          ? [
              eq(
                golfTournamentPurchases.stripePaymentIntentId,
                paymentIntentId,
              ),
            ]
          : []),
      ),
    });

  const referencedPurchaseId =
    session.metadata?.purchaseId ?? session.client_reference_id;
  const existingByPurchaseId =
    existingByStripeReference ??
    (referencedPurchaseId
      ? await db.query.golfTournamentPurchases.findFirst({
          where: eq(golfTournamentPurchases.id, referencedPurchaseId),
        })
      : null);

  let packageConfig = existingByPurchaseId
    ? getGolfTournamentPackage(existingByPurchaseId.packageId)
    : null;

  if (!packageConfig) {
    packageConfig = await resolveGolfPackageForSession(
      stripe,
      session,
      options.paymentLinkPackageCache,
    );
  }

  if (!packageConfig) {
    return { status: "ignored", reason: "not-bgsl-golf" };
  }

  const paidAt = new Date(session.created * 1000);
  const customerId = stripeObjectId(session.customer);
  const buyerName =
    session.customer_details?.name ??
    session.customer_details?.email ??
    existingByPurchaseId?.buyerName ??
    null;
  const buyerEmail =
    session.customer_details?.email ?? existingByPurchaseId?.buyerEmail ?? null;
  const buyerPhone =
    session.customer_details?.phone ?? existingByPurchaseId?.buyerPhone ?? null;
  const amountCents =
    session.amount_total ?? existingByPurchaseId?.amountCents ?? packageConfig.priceCents;
  const currency =
    session.currency?.toLowerCase() ??
    existingByPurchaseId?.currency ??
    "usd";

  let purchase;
  let resultStatus: "recorded" | "updated" | "already-recorded";
  let shouldNotifyAdmins = false;

  if (existingByPurchaseId) {
    const wasPaid = existingByPurchaseId.paymentStatus === "PAID";
    [purchase] = await db
      .update(golfTournamentPurchases)
      .set({
        buyerName,
        buyerEmail,
        buyerPhone,
        amountCents,
        currency,
        paymentStatus: "PAID",
        paidAt: existingByPurchaseId.paidAt ?? paidAt,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        updatedAt: new Date(),
      })
      .where(eq(golfTournamentPurchases.id, existingByPurchaseId.id))
      .returning();
    resultStatus = wasPaid ? "already-recorded" : "updated";
    shouldNotifyAdmins = !wasPaid;
  } else {
    const token = createCompletionToken();
    [purchase] = await db
      .insert(golfTournamentPurchases)
      .values({
        packageId: packageConfig.id,
        purchaseType: packageConfig.kind,
        buyerName,
        buyerEmail,
        buyerPhone,
        amountCents,
        currency,
        paymentStatus: "PAID",
        paidAt,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        completionTokenHash: hashCompletionToken(token),
        completionTokenExpiresAt: completionTokenExpiry(),
      })
      .onConflictDoNothing()
      .returning();

    if (!purchase) {
      purchase = await db.query.golfTournamentPurchases.findFirst({
        where: or(
          eq(golfTournamentPurchases.stripeCheckoutSessionId, session.id),
          ...(paymentIntentId
            ? [
                eq(
                  golfTournamentPurchases.stripePaymentIntentId,
                  paymentIntentId,
                ),
              ]
            : []),
        ),
      });
      resultStatus = "already-recorded";
    } else {
      resultStatus = "recorded";
      shouldNotifyAdmins = true;
    }
  }

  if (!purchase) {
    throw new Error(
      `Stripe session ${session.id} conflicted with an unknown purchase.`,
    );
  }

  await ensureGolfPlayerSlots(purchase.id, packageConfig);

  if (options.sendNotifications) {
    await sendGolfPurchaseConfirmation(purchase.id);
    if (shouldNotifyAdmins) {
      await sendAdminPurchaseNotification(purchase, packageConfig, session.id);
    }
  }

  console.info("[stripe:golf] checkout session recorded", {
    sessionId: session.id,
    purchaseId: purchase.id,
    packageId: packageConfig.id,
    status: resultStatus,
  });

  return {
    status: resultStatus,
    purchaseId: purchase.id,
    packageId: packageConfig.id,
  };
}

export async function reconcileGolfStripePayments(
  stripe: Stripe,
): Promise<GolfStripeReconciliationResult> {
  const configuredLinks = golfTournamentPackages.filter(
    (packageConfig) => packageConfig.checkoutUrl,
  );
  const matchedPaymentLinks: Array<{
    paymentLink: Stripe.PaymentLink;
    packageConfig: GolfTournamentPackage;
  }> = [];
  const paymentLinkPackageCache: PaymentLinkPackageCache = new Map();

  for await (const paymentLink of stripe.paymentLinks.list({ limit: 100 })) {
    const packageConfig = findGolfPackageByPaymentLinkUrl(paymentLink.url);
    if (!packageConfig) continue;

    matchedPaymentLinks.push({ paymentLink, packageConfig });
    paymentLinkPackageCache.set(paymentLink.id, packageConfig);
  }

  const result: GolfStripeReconciliationResult = {
    configuredLinks: configuredLinks.length,
    matchedLinks: matchedPaymentLinks.length,
    scannedSessions: 0,
    importedPurchases: 0,
    updatedPurchases: 0,
    existingPurchases: 0,
    ignoredSessions: 0,
    failedSessions: 0,
  };

  for (const { paymentLink } of matchedPaymentLinks) {
    const sessions = stripe.checkout.sessions.list({
      payment_link: paymentLink.id,
      status: "complete",
      created: { gte: RECONCILIATION_START },
      limit: 100,
    });

    for await (const session of sessions) {
      result.scannedSessions += 1;

      try {
        const recording = await recordGolfCheckoutSession(stripe, session, {
          sendNotifications: false,
          paymentLinkPackageCache,
        });

        switch (recording.status) {
          case "recorded":
            result.importedPurchases += 1;
            break;
          case "updated":
            result.updatedPurchases += 1;
            break;
          case "already-recorded":
            result.existingPurchases += 1;
            break;
          case "ignored":
            result.ignoredSessions += 1;
            break;
        }
      } catch (error) {
        result.failedSessions += 1;
        console.error("[stripe:golf] reconciliation session failed", {
          sessionId: session.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  console.info("[stripe:golf] reconciliation complete", result);
  return result;
}

export function findGolfPackageByPaymentLinkUrl(url: string) {
  const normalizedUrl = normalizePaymentLinkUrl(url);

  return (
    golfTournamentPackages.find(
      (packageConfig) =>
        packageConfig.checkoutUrl &&
        normalizePaymentLinkUrl(packageConfig.checkoutUrl) === normalizedUrl,
    ) ?? null
  );
}

function normalizePaymentLinkUrl(url: string) {
  const parsed = new URL(url);
  return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`;
}

async function resolveGolfPackageForSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  paymentLinkPackageCache: PaymentLinkPackageCache = new Map(),
) {
  const metadataPackageId = session.metadata?.packageId;
  if (metadataPackageId) {
    const metadataPackage = getGolfTournamentPackage(metadataPackageId);
    if (metadataPackage) return metadataPackage;
  }

  const paymentLinkId = stripeObjectId(session.payment_link);
  if (!paymentLinkId) return null;

  const cachedPackage = paymentLinkPackageCache.get(paymentLinkId);
  if (cachedPackage !== undefined) return cachedPackage;

  const paymentLink =
    typeof session.payment_link === "object" && session.payment_link
      ? session.payment_link
      : await stripe.paymentLinks.retrieve(paymentLinkId);
  const packageConfig = findGolfPackageByPaymentLinkUrl(paymentLink.url);
  paymentLinkPackageCache.set(paymentLinkId, packageConfig);
  return packageConfig;
}

async function ensureGolfPlayerSlots(
  purchaseId: string,
  packageConfig: GolfTournamentPackage,
) {
  const slotCount = includedGolfSlotCount(packageConfig.includedGolf);

  await Promise.all(
    Array.from({ length: slotCount }, (_, index) =>
      db
        .insert(golfTournamentPlayers)
        .values({
          purchaseId,
          slotNumber: index + 1,
        })
        .onConflictDoNothing(),
    ),
  );
}

async function sendAdminPurchaseNotification(
  purchase: typeof golfTournamentPurchases.$inferSelect,
  packageConfig: GolfTournamentPackage,
  stripeSessionId: string,
) {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  await sendGolfTournamentEmail({
    to: golfTournamentAdminEmails(),
    subject: "New paid BGSL golf tournament purchase",
    body: [
      "A BGSL golf tournament purchase was paid.",
      "",
      `Package: ${packageConfig.name}`,
      `Amount: ${formatGolfPackagePrice(purchase.amountCents)}`,
      `Buyer: ${purchase.buyerName ?? "Unknown"}`,
      `Email: ${purchase.buyerEmail ?? "Unknown"}`,
      `Stripe Checkout Session: ${stripeSessionId}`,
      purchase.stripePaymentIntentId
        ? `Stripe PaymentIntent: ${purchase.stripePaymentIntentId}`
        : null,
      "",
      `${appUrl}/golf-admin`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

function stripeObjectId(value: { id: string } | string | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}
