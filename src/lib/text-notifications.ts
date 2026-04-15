import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  adultUsers,
  textMessages,
  textRecipients,
  type EmailKind,
} from "@/db/schema";
import { env, isPokeConfigured } from "@/lib/env";

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

  const sendResults = await Promise.all(
    resolved.map(async (recipient) => {
      try {
        const override = input.renderBody
          ? await input.renderBody({
              ...recipient,
              userId: recipient.userId ?? null,
            })
          : undefined;
        const body = override?.body ?? input.body;

        if (!isPokeConfigured()) {
          console.info(
            `[imessage:console] ${recipient.phone}\n${body}`,
          );
          return {
            recipient,
            deliveryStatus: "SENT" as const,
            providerMessageId: `console-${message.id}-${recipient.phone}`,
            deliveredAt: new Date(),
            errorMessage: null,
          };
        }

        const providerMessageId = await postToPoke({
          phone: recipient.phone,
          body,
        });

        // Poke returns 2xx when it accepts the instruction, not when the
        // iMessage is delivered. Record PENDING so the UI/audit trail doesn't
        // falsely report delivery. The reminder_deliveries row is still
        // written by the caller to enforce one-attempt-per-user.
        return {
          recipient,
          deliveryStatus: "PENDING" as const,
          providerMessageId,
          deliveredAt: null,
          errorMessage: null,
        };
      } catch (error) {
        return {
          recipient,
          deliveryStatus: "FAILED" as const,
          providerMessageId: null,
          deliveredAt: null,
          errorMessage: error instanceof Error ? error.message : "Text send failed.",
        };
      }
    }),
  );

  await db.insert(textRecipients).values(
    sendResults.map((result) => ({
      textMessageId: message.id,
      userId: result.recipient.userId ?? null,
      playerId: result.recipient.playerId ?? null,
      phone: result.recipient.phone,
      deliveryStatus: result.deliveryStatus,
      providerMessageId: result.providerMessageId,
      deliveredAt: result.deliveredAt,
      errorMessage: result.errorMessage,
    })),
  );

  const storedRecipients = await db
    .select({ id: textRecipients.id, phone: textRecipients.phone })
    .from(textRecipients)
    .where(eq(textRecipients.textMessageId, message.id));
  const recipientIdByPhone = new Map(
    storedRecipients.map((row) => [row.phone, row.id]),
  );

  await db
    .update(textMessages)
    .set({ sentAt: new Date(), updatedAt: new Date() })
    .where(eq(textMessages.id, message.id));

  return {
    messageId: message.id,
    sendResults: sendResults.map((result) => ({
      ...result,
      textRecipientId: recipientIdByPhone.get(result.recipient.phone) ?? null,
    })),
  };
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

async function postToPoke({
  phone,
  body,
}: {
  phone: string;
  body: string;
}): Promise<string | null> {
  // Poke's API is a natural-language instruction bus to the assistant tied to
  // the API key owner. We ask it to send an iMessage on our behalf; the assistant
  // relays the message via its iMessage integration. Response acceptance does
  // not guarantee delivery — we record the accepted instruction id (if any).
  const response = await fetch(env.POKE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.POKE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Send an iMessage to ${phone} with exactly this text (do not add anything):\n\n${body}`,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Poke API ${response.status}: ${text || response.statusText}`);
  }

  const json = (await response.json().catch(() => null)) as
    | { id?: string; messageId?: string }
    | null;
  return json?.id ?? json?.messageId ?? null;
}
