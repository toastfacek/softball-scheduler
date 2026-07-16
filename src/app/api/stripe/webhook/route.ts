import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { db } from "@/db";
import {
  golfTournamentPlayers,
  golfTournamentPurchases,
} from "@/db/schema";
import { env } from "@/lib/env";
import { sendGolfTournamentEmail } from "@/lib/golf-tournament/email";
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

export async function POST(request: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse("Stripe webhook is not configured.", {
      status: 503,
    });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing Stripe signature.", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook.";
    return new NextResponse(message, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await markGolfPurchasePaid(session);
  }

  return NextResponse.json({ received: true });
}

async function markGolfPurchasePaid(session: Stripe.Checkout.Session) {
  const purchaseId = session.metadata?.purchaseId;

  if (!purchaseId) return;

  const existing = await db.query.golfTournamentPurchases.findFirst({
    where: eq(golfTournamentPurchases.id, purchaseId),
  });

  if (!existing || existing.paymentStatus === "PAID") return;

  const now = new Date();
  const [purchase] = await db
    .update(golfTournamentPurchases)
    .set({
      buyerName:
        session.customer_details?.name ??
        session.customer_details?.email ??
        existing.buyerName,
      buyerEmail: session.customer_details?.email ?? existing.buyerEmail,
      paymentStatus: "PAID",
      paidAt: now,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
      stripeCustomerId:
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id,
      updatedAt: now,
    })
    .where(eq(golfTournamentPurchases.id, purchaseId))
    .returning();

  if (!purchase) return;

  const packageConfig = getGolfTournamentPackage(purchase.packageId);
  const slotCount = packageConfig
    ? includedGolfSlotCount(packageConfig.includedGolf)
    : 0;

  await Promise.all(
    Array.from({ length: slotCount }, (_, index) =>
      db
        .insert(golfTournamentPlayers)
        .values({
          purchaseId: purchase.id,
          slotNumber: index + 1,
        })
        .onConflictDoNothing(),
    ),
  );

  const buyerEmail = purchase.buyerEmail;
  const completionToken = session.metadata?.completionToken;
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const completionUrl = completionToken
    ? `${appUrl}/golf-tournament/complete/${completionToken}`
    : null;
  const contactEmail = golfTournamentContactEmail();

  if (buyerEmail) {
    await sendGolfTournamentEmail({
      to: [buyerEmail],
      subject: `You're confirmed for ${GOLF_TOURNAMENT_TITLE}`,
      body: [
        `You're confirmed. Thanks for supporting ${GOLF_TOURNAMENT_TITLE}.`,
        "",
        `Package: ${packageConfig?.name ?? purchase.packageId}`,
        `Amount paid: ${formatGolfPackagePrice(purchase.amountCents)}`,
        "",
        completionUrl
          ? "Use this private link to add player names, sponsor details, and logo/artwork:"
          : "BGSL will follow up to collect player names, sponsor details, and logo/artwork.",
        completionUrl,
        "",
        contactEmail ? `Questions? Email ${contactEmail}.` : null,
        "",
        GOLF_TOURNAMENT_SAFE_PROCEEDS,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  await sendGolfTournamentEmail({
    to: golfTournamentAdminEmails(),
    subject: "New paid BGSL golf tournament purchase",
    body: [
      "A BGSL golf tournament purchase was paid.",
      "",
      `Package: ${packageConfig?.name ?? purchase.packageId}`,
      `Amount: ${formatGolfPackagePrice(purchase.amountCents)}`,
      `Buyer: ${purchase.buyerName ?? "Unknown"}`,
      `Email: ${buyerEmail ?? "Unknown"}`,
      `Stripe Checkout Session: ${session.id}`,
      purchase.stripePaymentIntentId
        ? `Stripe PaymentIntent: ${purchase.stripePaymentIntentId}`
        : null,
      "",
      `${appUrl}/settings/golf-tournament`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
