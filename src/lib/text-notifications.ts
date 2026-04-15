import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { adultUsers, type EmailKind } from "@/db/schema";

type RecipientInput = {
  email?: string | null;
  userId?: string | null;
  playerId?: string | null;
  phone?: string | null;
};

type PerRecipientContent = {
  body?: string;
};

type SendTeamTextInput = {
  teamId: string;
  createdByUserId?: string | null;
  eventId?: string | null;
  kind: EmailKind | "TEXT";
  body: string;
  recipients: RecipientInput[];
  metadata?: Record<string, string | number | boolean | null>;
  renderBody?: (
    recipient: RecipientInput & { phone: string },
  ) => PerRecipientContent | Promise<PerRecipientContent>;
};

type ResolvedRecipient = RecipientInput & {
  phone: string;
};

export async function sendTeamText(input: SendTeamTextInput) {
  const userIds = Array.from(
    new Set(
      input.recipients
        .map((recipient) => recipient.userId)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );

  const userPhoneRows = userIds.length
    ? await db
        .select({ id: adultUsers.id, phone: adultUsers.phone })
        .from(adultUsers)
        .where(inArray(adultUsers.id, userIds))
    : [];

  const phoneByUserId = new Map(
    userPhoneRows.map((row) => [row.id, row.phone ?? null]),
  );

  const resolved = dedupeByPhone(
    input.recipients
      .map((recipient): ResolvedRecipient | null => {
        const phone = recipient.phone ?? (recipient.userId ? phoneByUserId.get(recipient.userId) : null);
        if (!phone) return null;
        return { ...recipient, phone };
      })
      .filter((recipient): recipient is ResolvedRecipient => recipient !== null),
  );

  if (resolved.length === 0) {
    return null;
  }

  const results = await Promise.all(
    resolved.map(async (recipient) => {
      try {
        const override = input.renderBody
          ? await input.renderBody(recipient)
          : undefined;
        const body = override?.body ?? input.body;

        console.info(`[imessage:console] ${recipient.phone}\n${body}`);

        return {
          recipient,
          deliveryStatus: "SENT" as const,
          deliveredAt: new Date(),
          errorMessage: null,
        };
      } catch (error) {
        return {
          recipient,
          deliveryStatus: "FAILED" as const,
          deliveredAt: null,
          errorMessage: error instanceof Error ? error.message : "Text send failed.",
        };
      }
    }),
  );

  return {
    teamId: input.teamId,
    createdByUserId: input.createdByUserId ?? null,
    eventId: input.eventId ?? null,
    kind: input.kind,
    metadata: input.metadata ?? null,
    sendResults: results,
  };
}

function dedupeByPhone<T extends { phone: string }>(recipients: T[]) {
  return Array.from(
    new Map(
      recipients.map((recipient) => [
        recipient.phone.replace(/\D/g, "") || recipient.phone.trim(),
        recipient,
      ]),
    ).values(),
  );
}
