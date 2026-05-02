import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { db } from "@/db";
import { textRecipients } from "@/db/schema";
import { env } from "@/lib/env";

// Twilio posts status callbacks as application/x-www-form-urlencoded with
// fields including MessageSid, MessageStatus ("queued"|"sent"|"delivered"
// |"undelivered"|"failed"), ErrorCode, ErrorMessage. X-Twilio-Signature
// is the HMAC-SHA1 auth over the URL + sorted body params.
export async function POST(request: NextRequest) {
  if (!env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json(
      { ok: false, reason: "twilio_not_configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const url = request.url;
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const valid = twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    params,
  );

  if (!valid) {
    return NextResponse.json(
      { ok: false, reason: "bad_signature" },
      { status: 403 },
    );
  }

  const messageSid = params.MessageSid;
  const status = params.MessageStatus;
  const errorMessage = params.ErrorMessage ?? null;
  const textRecipientId = request.nextUrl.searchParams.get("textRecipientId");

  if (!messageSid || !status) {
    return NextResponse.json(
      { ok: false, reason: "missing_fields" },
      { status: 400 },
    );
  }

  // Twilio may not always emit a later "delivered" status for every carrier.
  // Once Twilio reports "sent", the message has left Twilio for the carrier,
  // so treat both sent and delivered as successful from the app's perspective.
  const deliveryStatus =
    status === "sent" || status === "delivered"
      ? ("SENT" as const)
      : status === "failed" || status === "undelivered"
        ? ("FAILED" as const)
        : null;

  if (deliveryStatus === null) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const now = new Date();

  await db
    .update(textRecipients)
    .set({
      deliveryStatus,
      providerMessageId: messageSid,
      deliveredAt: deliveryStatus === "SENT" ? now : null,
      errorMessage: deliveryStatus === "FAILED" ? errorMessage : null,
      updatedAt: now,
    })
    .where(
      textRecipientId
        ? eq(textRecipients.id, textRecipientId)
        : eq(textRecipients.providerMessageId, messageSid),
    );

  return NextResponse.json({ ok: true });
}
