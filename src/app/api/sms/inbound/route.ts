import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { db } from "@/db";
import { adultUsers } from "@/db/schema";
import { env } from "@/lib/env";

// Twilio's carrier-level STOP handling auto-blacklists the sender from
// receiving further messages, but does not tell our app about it. Without
// this webhook, the admin UI would still show text_opt_in = true for
// users who have opted out, and we'd keep trying to send (Twilio would
// reject with 21610). This webhook keeps our DB honest.
//
// Twilio posts to the "A MESSAGE COMES IN" URL configured on the phone
// number. Fields: From (E.164), Body (text the user sent).
const OPT_OUT_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

export async function POST(request: NextRequest) {
  if (!env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 503 });
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
    return new NextResponse("", { status: 403 });
  }

  const from = params.From ?? "";
  const bodyText = (params.Body ?? "").trim().toUpperCase();

  if (from && OPT_OUT_KEYWORDS.has(bodyText)) {
    // Phones are stored in the original formatted form (e.g. "718-316-2321");
    // Twilio sends E.164 ("+17183162321"). Normalize both sides to digits.
    const digits = from.replace(/\D/g, "");
    await db
      .update(adultUsers)
      .set({ textOptIn: false, updatedAt: new Date() })
      .where(
        sql`regexp_replace(${adultUsers.phone}, '\D', '', 'g') = ${digits}`,
      );
  }

  // Empty TwiML — Twilio's own STOP auto-reply is enough; we don't want a
  // double-message. For non-STOP inbound we intentionally don't reply.
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response/>',
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );
}
