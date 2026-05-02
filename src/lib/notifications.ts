import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/db";
import {
  emailMessages,
  emailRecipients,
  type EmailKind,
} from "@/db/schema";
import { env, isResendConfigured } from "@/lib/env";
import {
  buildEmailFromAddress,
  markdownishToHtml,
  normalizeEmail,
} from "@/lib/utils";

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

type RenderBodyContext = {
  messageId: string;
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
    context: RenderBodyContext,
  ) => PerRecipientContent | Promise<PerRecipientContent>;
};

const resend = new Resend(env.RESEND_API_KEY || "re_placeholder_key");
const resendFromAddress = buildEmailFromAddress(
  env.AUTH_RESEND_FROM,
  env.AUTH_RESEND_FROM_NAME,
);
const RESEND_SEND_INTERVAL_MS = 250;

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

  const sendResults = [];

  for (const [index, recipient] of uniqueRecipients.entries()) {
    if (index > 0 && isResendConfigured()) {
      await sleep(RESEND_SEND_INTERVAL_MS);
    }

    try {
      const override = input.renderBody
        ? await input.renderBody(recipient, { messageId: message.id })
        : undefined;
      const subject = override?.subject ?? input.subject;
      const body = override?.body ?? input.body;
      const html = override?.html ?? markdownishToHtml(body);

      if (!isResendConfigured()) {
        console.info(
          `[email:console] ${subject} -> ${recipient.email}\n${body}`,
        );

        sendResults.push({
          recipient,
          deliveryStatus: "SENT" as const,
          providerMessageId: `console-${message.id}-${recipient.email}`,
          deliveredAt: new Date(),
          errorMessage: null,
        });
        continue;
      }

      const response = await resend.emails.send({
        from: resendFromAddress,
        to: recipient.email,
        subject,
        text: body,
        html,
      });

      if (response.error) {
        sendResults.push({
          recipient,
          deliveryStatus: "FAILED" as const,
          providerMessageId: null,
          deliveredAt: null,
          errorMessage: formatResendError(response.error),
        });
        continue;
      }

      if (!response.data?.id) {
        sendResults.push({
          recipient,
          deliveryStatus: "FAILED" as const,
          providerMessageId: null,
          deliveredAt: null,
          errorMessage: "Resend did not return a message id.",
        });
        continue;
      }

      sendResults.push({
        recipient,
        deliveryStatus: "SENT" as const,
        providerMessageId: response.data.id,
        deliveredAt: new Date(),
        errorMessage: null,
      });
    } catch (error) {
      sendResults.push({
        recipient,
        deliveryStatus: "FAILED" as const,
        providerMessageId: null,
        deliveredAt: null,
        errorMessage:
          error instanceof Error ? error.message : "Email send failed.",
      });
    }
  }

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatResendError(error: {
  message?: string | null;
  name?: string | null;
  statusCode?: number | null;
}) {
  const status = error.statusCode ? `${error.statusCode} ` : "";
  const name = error.name ? `${error.name}: ` : "";
  return `${status}${name}${error.message ?? "Resend email send failed."}`;
}
