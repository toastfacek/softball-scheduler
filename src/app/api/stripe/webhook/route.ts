import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { env } from "@/lib/env";
import { recordGolfCheckoutSession } from "@/lib/golf-tournament/stripe-payments";

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

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    const result = await recordGolfCheckoutSession(stripe, session, {
      sendNotifications: true,
    });
    console.info("[stripe:webhook] checkout event handled", {
      eventId: event.id,
      eventType: event.type,
      sessionId: session.id,
      result: result.status,
    });
  }

  return NextResponse.json({ received: true });
}
