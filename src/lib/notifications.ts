import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/db";
import {
  emailMessages,
  emailRecipients,
  type EmailKind,
} from "@/db/schema";
import { env, isResendConfigured } from "@/lib/env";
import { markdownishToHtml, normalizeEmail } from "@/lib/utils";

type RecipientInput = {
  email: string;
  userId?: string | null;
  playerId?: string | null;
};

type SendTeamEmailInput = {
  teamId: string;
  createdByUserId?: string | null;
  eventId?: string | null;
  kind: EmailKind;
  subject: string;
  body: string;
  recipients: RecipientInput[];
  metadata?: Record<string, string | number | boolean | null>;
};

const resend = new Resend(env.RESEND_API_KEY || "re_placeholder_key");

export async function sendTeamEmail(input: SendTeamEmailInput) {
  const uniqueRecipients = Array.from(
    new Map(
      input.recipients.map((recipient) => [
        normalizeEmail(recipient.email),
        { ...recipient, email: normalizeEmail(recipient.email) },
      ]),
    ).values(),
  );

  if (uniqueRecipients.length === 0) {
    return null;
  }

  const [message] = await db
    .insert(emailMessages)
    .values({
      teamId: input.teamId,
      createdByUserId: input.createdByUserId ?? null,
      eventId: input.eventId ?? null,
      kind: input.kind,
      subject: input.subject,
      body: input.body,
      metadata: input.metadata,
    })
    .returning();

  const sendResults = await Promise.all(
    uniqueRecipients.map(async (recipient) => {
      try {
        if (!isResendConfigured()) {
          console.info(
            `[email:console] ${input.subject} -> ${recipient.email}\n${input.body}`,
          );

          return {
            recipient,
            deliveryStatus: "SENT" as const,
            providerMessageId: `console-${message.id}-${recipient.email}`,
            deliveredAt: new Date(),
            errorMessage: null,
          };
        }

        const response = await resend.emails.send({
          from: env.AUTH_RESEND_FROM,
          to: recipient.email,
          subject: input.subject,
          text: input.body,
          html: markdownishToHtml(input.body),
        });

        return {
          recipient,
          deliveryStatus: "SENT" as const,
          providerMessageId: response.data?.id ?? null,
          deliveredAt: new Date(),
          errorMessage: null,
        };
      } catch (error) {
        return {
          recipient,
          deliveryStatus: "FAILED" as const,
          providerMessageId: null,
          deliveredAt: null,
          errorMessage:
            error instanceof Error ? error.message : "Email send failed.",
        };
      }
    }),
  );

  await db.insert(emailRecipients).values(
    sendResults.map((result) => ({
      emailMessageId: message.id,
      userId: result.recipient.userId ?? null,
      playerId: result.recipient.playerId ?? null,
      email: result.recipient.email,
      deliveryStatus: result.deliveryStatus,
      providerMessageId: result.providerMessageId,
      deliveredAt: result.deliveredAt,
      errorMessage: result.errorMessage,
    })),
  );

  await db
    .update(emailMessages)
    .set({ sentAt: new Date(), updatedAt: new Date() })
    .where(eq(emailMessages.id, message.id));

  return {
    messageId: message.id,
    sendResults,
  };
}

