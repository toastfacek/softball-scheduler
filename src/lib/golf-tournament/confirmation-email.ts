import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/db";
import { golfTournamentPurchases } from "@/db/schema";
import { env, isResendConfigured } from "@/lib/env";
import {
  GOLF_TOURNAMENT_ADDRESS,
  GOLF_TOURNAMENT_START,
  GOLF_TOURNAMENT_TITLE,
  GOLF_TOURNAMENT_VENUE,
  golfTournamentContactEmail,
} from "@/lib/golf-tournament/event";
import {
  formatGolfPackagePrice,
  getGolfTournamentPackage,
} from "@/lib/golf-tournament/packages";
import { buildEmailFromAddress, escapeHtml } from "@/lib/utils";

const resend = new Resend(env.RESEND_API_KEY || "re_placeholder_key");
const from = buildEmailFromAddress(
  env.AUTH_RESEND_FROM,
  env.AUTH_RESEND_FROM_NAME,
);

type ConfirmationEmailInput = {
  buyerName?: string | null;
  packageName: string;
  amount: string;
  playerNames?: string[];
  tournamentUrl: string;
};

export function buildGolfConfirmationEmail(input: ConfirmationEmailInput) {
  const greeting = input.buyerName?.trim()
    ? `Hi ${input.buyerName.trim()},`
    : "Hello,";
  const eventDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(GOLF_TOURNAMENT_START);
  const players = input.playerNames?.filter(Boolean) ?? [];
  const contactEmail = golfTournamentContactEmail();
  const subject = `You're confirmed for ${GOLF_TOURNAMENT_TITLE}`;
  const text = [
    greeting,
    "",
    "You're on the tee sheet.",
    `Your payment for ${input.packageName} has been confirmed. Thank you for supporting Beverly Girls Softball.`,
    "",
    `Package: ${input.packageName}`,
    `Amount paid: ${input.amount}`,
    players.length ? `Golfers: ${players.join(", ")}` : null,
    "",
    `${eventDate} · ${GOLF_TOURNAMENT_VENUE}`,
    GOLF_TOURNAMENT_ADDRESS,
    "",
    `Tournament details: ${input.tournamentUrl}`,
    contactEmail ? `Questions? ${contactEmail}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject,
    text,
    html: renderConfirmationHtml({
      ...input,
      greeting,
      eventDate,
      players,
      contactEmail,
    }),
  };
}

export async function sendGolfPurchaseConfirmation(
  purchaseId: string,
  options: { force?: boolean } = {},
) {
  const purchase = await db.query.golfTournamentPurchases.findFirst({
    where: eq(golfTournamentPurchases.id, purchaseId),
  });

  if (!purchase || purchase.paymentStatus !== "PAID") {
    return { status: "not-paid" as const };
  }
  if (purchase.confirmationEmailSentAt && !options.force) {
    return { status: "already-sent" as const };
  }
  if (!purchase.buyerEmail) {
    return { status: "missing-email" as const };
  }
  if (!isResendConfigured()) {
    throw new Error("Resend is not configured.");
  }

  const players = await db.query.golfTournamentPlayers.findMany({
    where: (table, { eq }) => eq(table.purchaseId, purchase.id),
    orderBy: (table, { asc }) => [asc(table.slotNumber)],
  });
  const packageConfig = getGolfTournamentPackage(purchase.packageId);
  const tournamentUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/golf-tournament`;
  const email = buildGolfConfirmationEmail({
    buyerName: purchase.buyerName,
    packageName: packageConfig?.name ?? purchase.packageId,
    amount: formatGolfPackagePrice(purchase.amountCents),
    playerNames: players.map((player) => player.name ?? "").filter(Boolean),
    tournamentUrl,
  });

  await db
    .update(golfTournamentPurchases)
    .set({
      confirmationEmailStatus: "PENDING",
      confirmationEmailError: null,
      updatedAt: new Date(),
    })
    .where(eq(golfTournamentPurchases.id, purchase.id));

  try {
    const response = await resend.emails.send({
      from,
      to: purchase.buyerEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (response.error || !response.data?.id) {
      throw new Error(
        response.error?.message ?? "Resend did not return a message id.",
      );
    }

    const sentAt = new Date();
    await db
      .update(golfTournamentPurchases)
      .set({
        confirmationEmailStatus: "SENT",
        confirmationEmailSentAt: sentAt,
        confirmationEmailProviderId: response.data.id,
        confirmationEmailError: null,
        updatedAt: sentAt,
      })
      .where(eq(golfTournamentPurchases.id, purchase.id));

    return { status: "sent" as const, providerMessageId: response.data.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Confirmation email failed.";
    await db
      .update(golfTournamentPurchases)
      .set({
        confirmationEmailStatus: "FAILED",
        confirmationEmailError: message,
        updatedAt: new Date(),
      })
      .where(eq(golfTournamentPurchases.id, purchase.id));
    throw error;
  }
}

export async function sendGolfConfirmationPreview(to: string) {
  if (!isResendConfigured()) {
    throw new Error("Resend is not configured.");
  }

  const email = buildGolfConfirmationEmail({
    buyerName: "Michelle",
    packageName: "Foursome Registration",
    amount: "$640",
    playerNames: [
      "Michelle Lambert",
      "Missy Ulrich",
      "Meesh Ritchie",
      "Amie Crawford",
    ],
    tournamentUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/golf-tournament`,
  });
  const response = await resend.emails.send({
    from,
    to,
    subject: `[TEST] ${email.subject}`,
    text: `TEST EMAIL — No payment or registration was changed.\n\n${email.text}`,
    html: `<div style="max-width:620px;margin:0 auto 12px;padding:10px 14px;background:#f4d35e;color:#082116;font:700 12px Arial,sans-serif;text-align:center;letter-spacing:1px">TEST EMAIL — NO PAYMENT OR REGISTRATION WAS CHANGED</div>${email.html}`,
  });

  if (response.error || !response.data?.id) {
    throw new Error(
      response.error?.message ?? "Resend did not return a message id.",
    );
  }

  return response.data.id;
}

function renderConfirmationHtml(
  input: ConfirmationEmailInput & {
    greeting: string;
    eventDate: string;
    players: string[];
    contactEmail: string;
  },
) {
  const playerRows = input.players.length
    ? `<tr><td style="padding:0 0 22px"><p style="margin:0 0 8px;color:#557064;font:700 11px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase">Your foursome</p><p style="margin:0;color:#082116;font:16px/1.7 Georgia,serif">${input.players.map(escapeHtml).join(" · ")}</p></td></tr>`
    : "";
  const logoUrl = `${input.tournamentUrl.replace(/\/golf-tournament$/, "")}/golf-tournament/bgsl-logo.png`;

  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#edf2df;color:#082116">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf2df"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffaf0;border:1px solid #d8c28a">
<tr><td style="background:#006747;padding:24px 34px;border-bottom:6px solid #f4d35e">
<table role="presentation" width="100%"><tr><td><p style="margin:0;color:#f4d35e;font:700 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase">Beverly Girls Softball</p><p style="margin:7px 0 0;color:#f8f2df;font:700 21px Georgia,serif">Tee Up for BGSL</p></td><td align="right"><img src="${escapeHtml(logoUrl)}" width="62" alt="BGSL" style="display:block;max-width:62px;height:auto"></td></tr></table>
</td></tr>
<tr><td style="padding:42px 34px 18px"><p style="margin:0 0 18px;color:#557064;font:15px/1.6 Arial,sans-serif">${escapeHtml(input.greeting)}</p><h1 style="margin:0;color:#082116;font:700 42px/1.04 Georgia,serif;letter-spacing:-1px">You’re on the<br>tee sheet.</h1><p style="margin:20px 0 0;color:#365247;font:16px/1.7 Arial,sans-serif">Your payment is confirmed. Thank you for showing up for Beverly’s girls—on the field and in our community.</p></td></tr>
<tr><td style="padding:18px 34px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:2px solid #082116;border-bottom:1px solid #d8c28a">
<tr><td style="padding:18px 0"><p style="margin:0 0 5px;color:#557064;font:700 11px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase">Package</p><p style="margin:0;color:#082116;font:700 20px Georgia,serif">${escapeHtml(input.packageName)}</p></td><td align="right" style="padding:18px 0"><p style="margin:0 0 5px;color:#557064;font:700 11px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase">Paid</p><p style="margin:0;color:#006747;font:700 24px Georgia,serif">${escapeHtml(input.amount)}</p></td></tr>
</table></td></tr>
<tr><td style="padding:8px 34px 6px"><table role="presentation" width="100%">${playerRows}<tr><td><p style="margin:0 0 8px;color:#557064;font:700 11px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase">Save the date</p><p style="margin:0 0 4px;color:#082116;font:700 18px Georgia,serif">${escapeHtml(input.eventDate)}</p><p style="margin:0;color:#365247;font:15px/1.6 Arial,sans-serif">${escapeHtml(GOLF_TOURNAMENT_VENUE)}<br>${escapeHtml(GOLF_TOURNAMENT_ADDRESS)}</p></td></tr></table></td></tr>
<tr><td style="padding:30px 34px 42px"><a href="${escapeHtml(input.tournamentUrl)}" style="display:inline-block;background:#f4d35e;border:1px solid #b58a22;color:#082116;padding:14px 21px;text-decoration:none;font:700 12px Arial,sans-serif;letter-spacing:1.2px;text-transform:uppercase">View tournament details →</a></td></tr>
<tr><td style="background:#082116;padding:22px 34px"><p style="margin:0;color:#cbd8ca;font:12px/1.6 Arial,sans-serif">Questions? <a href="mailto:${escapeHtml(input.contactEmail)}" style="color:#f4d35e">${escapeHtml(input.contactEmail)}</a><br>Proceeds support BGSL programming, equipment, scholarships, fields, and opportunities for girls across Beverly.</p></td></tr>
</table></td></tr></table></body></html>`;
}
