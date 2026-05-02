import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  adultUsers,
  textMessages,
  textRecipients,
  type EmailKind,
} from "@/db/schema";
import { env } from "@/lib/env";
import { sendSms } from "@/lib/sms-provider";

type RecipientInput = {
  phone?: string | null;
  userId?: string | null;
  playerId?: string | null;
};

type PerRecipientContent = {
  body?: string;
};

type SendTeamTextInput = {
  teamId: string;
  createdByUserId?: string | null;
  eventId?: string | null;
  kind: EmailKind;
  body: string;
  recipients: RecipientInput[];
  metadata?: Record<string, string | number | boolean | null>;
  renderBody?: (
    recipient: RecipientInput & { phone: string; userId: string | null },
  ) => PerRecipientContent | Promise<PerRecipientContent>;
};

type ResolvedRecipient = RecipientInput & { phone: string };

export async function sendTeamText(input: SendTeamTextInput) {
  const resolved = await resolveRecipients(input.recipients);
  if (resolved.length === 0) return null;

  const [message] = await db
    .insert(textMessages)
    .values({
      teamId: input.teamId,
      createdByUserId: input.createdByUserId ?? null,
      eventId: input.eventId ?? null,
      kind: input.kind,
      body: input.body,
      metadata: input.metadata,
    })
    .returning();

  const inserted = await db
    .insert(textRecipients)
    .values(
      resolved.map((recipient) => ({
        textMessageId: message.id,
        userId: recipient.userId ?? null,
        playerId: recipient.playerId ?? null,
        phone: recipient.phone,
        deliveryStatus: "PENDING" as const,
      })),
    )
    .returning({ id: textRecipients.id });

  const sendResults = await Promise.all(
    resolved.map(async (recipient, index) => {
      const textRecipientId = inserted[index]?.id;
      if (!textRecipientId) {
        throw new Error("Failed to create SMS recipient audit row.");
      }

      try {
        const override = input.renderBody
          ? await input.renderBody({
              ...recipient,
              userId: recipient.userId ?? null,
            })
          : undefined;
        const body = override?.body ?? input.body;

        const result = await sendSms({
          to: recipient.phone,
          body,
          statusCallbackUrl: statusCallbackUrlFor(textRecipientId),
        });

        if (result.status === "FAILED") {
          const sendResult = {
            recipient,
            textRecipientId,
            smsStatus: result.status,
            deliveryStatus: "FAILED" as const,
            providerMessageId: null,
            deliveredAt: null,
            errorMessage: result.errorMessage,
          };
          await updateTextRecipientSendResult(sendResult);
          return sendResult;
        }

        if (result.status === "CONSOLE_FALLBACK") {
          const sendResult = {
            recipient,
            textRecipientId,
            smsStatus: result.status,
            deliveryStatus: "FAILED" as const,
            providerMessageId: result.providerMessageId,
            deliveredAt: null,
            errorMessage: "Twilio is not configured; SMS was not sent.",
          };
          await updateTextRecipientSendResult(sendResult);
          return sendResult;
        }

        // Twilio accepted the message. Real delivery status arrives via the
        // /api/sms/status webhook, which upgrades this row to SENT (with
        // deliveredAt) or FAILED on terminal status.
        const sendResult = {
          recipient,
          textRecipientId,
          smsStatus: result.status,
          deliveryStatus: "PENDING" as const,
          providerMessageId: result.providerMessageId,
          deliveredAt: null,
          errorMessage: null,
        };
        await updateTextRecipientSendResult(sendResult);
        return sendResult;
      } catch (error) {
        const sendResult = {
          recipient,
          textRecipientId,
          smsStatus: "FAILED" as const,
          deliveryStatus: "FAILED" as const,
          providerMessageId: null,
          deliveredAt: null,
          errorMessage:
            error instanceof Error ? error.message : "SMS send failed.",
        };
        await updateTextRecipientSendResult(sendResult);
        return sendResult;
      }
    }),
  );

  await db
    .update(textMessages)
    .set({ sentAt: new Date(), updatedAt: new Date() })
    .where(eq(textMessages.id, message.id));

  return {
    messageId: message.id,
    sendResults,
  };
}

type TextSendResult = {
  textRecipientId: string;
  deliveryStatus: "PENDING" | "SENT" | "FAILED";
  providerMessageId: string | null;
  deliveredAt: Date | null;
  errorMessage: string | null;
};

async function updateTextRecipientSendResult(result: TextSendResult) {
  if (result.deliveryStatus === "PENDING") {
    await db
      .update(textRecipients)
      .set({
        providerMessageId: result.providerMessageId,
        updatedAt: new Date(),
      })
      .where(eq(textRecipients.id, result.textRecipientId));
    return;
  }

  await db
    .update(textRecipients)
    .set({
      deliveryStatus: result.deliveryStatus,
      providerMessageId: result.providerMessageId,
      deliveredAt: result.deliveredAt,
      errorMessage: result.errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(textRecipients.id, result.textRecipientId));
}

function statusCallbackUrlFor(textRecipientId: string) {
  if (!env.TWILIO_STATUS_CALLBACK_URL) return undefined;

  try {
    const url = new URL(env.TWILIO_STATUS_CALLBACK_URL);
    url.searchParams.set("textRecipientId", textRecipientId);
    return url.toString();
  } catch {
    return env.TWILIO_STATUS_CALLBACK_URL;
  }
}

async function resolveRecipients(
  recipients: RecipientInput[],
): Promise<ResolvedRecipient[]> {
  const userIds = Array.from(
    new Set(
      recipients
        .map((r) => r.userId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const userRows = userIds.length
    ? await db
        .select({
          id: adultUsers.id,
          phone: adultUsers.phone,
          textOptIn: adultUsers.textOptIn,
        })
        .from(adultUsers)
        .where(inArray(adultUsers.id, userIds))
    : [];

  const byUserId = new Map(userRows.map((row) => [row.id, row]));

  const hydrated = recipients
    .map((r): ResolvedRecipient | null => {
      const user = r.userId ? byUserId.get(r.userId) : null;
      if (user && !user.textOptIn) return null;

      const rawPhone = r.phone ?? user?.phone ?? null;
      const phone = normalizePhone(rawPhone);
      if (!phone) return null;

      return { ...r, phone };
    })
    .filter((r): r is ResolvedRecipient => r !== null);

  // Dedupe per-guardian (userId), falling back to phone for recipients
  // without a userId. Two guardians sharing a phone get two messages, but
  // each keeps its own signed RSVP + unsubscribe tokens — correctness
  // over device-level coalescing.
  return Array.from(
    new Map(
      hydrated.map((r) => [r.userId ?? `phone:${r.phone}`, r] as const),
    ).values(),
  );
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Assume US if 10 digits; otherwise trust the provided country code.
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return e164;
}
