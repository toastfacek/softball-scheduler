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

type PerRecipientContent = {
  subject?: string;
  body?: string;
  html?: string;
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
  /**
   * Optional per-recipient content override. Return a partial content object
   * (subject/body/html) to personalize the outbound email — useful for
   * per-guardian RSVP link URLs. The top-level subject/body are stored on the
   * parent email_messages row as the canonical message and used as a fallback
   * when this hook is not provided (or returns undefined).
   */
  renderBody?: (
    recipient: RecipientInput,
  ) => PerRecipientContent | Promise<PerRecipientContent>;
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
        const override = input.renderBody
          ? await input.renderBody(recipient)
          : undefined;
        const subject = override?.subject ?? input.subject;
        const body = override?.body ?? input.body;
        const html = override?.html ?? markdownishToHtml(body);

        if (!isResendConfigured()) {
          console.info(
            `[email:console] ${subject} -> ${recipient.email}\n${body}`,
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
          subject,
          text: body,
          html,
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

