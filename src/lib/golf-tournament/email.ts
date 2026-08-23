import { Resend } from "resend";

import { env, isResendConfigured } from "@/lib/env";
import {
  buildEmailFromAddress,
  markdownishToHtml,
  normalizeEmail,
} from "@/lib/utils";

const resend = new Resend(env.RESEND_API_KEY || "re_placeholder_key");
const from = buildEmailFromAddress(
  env.AUTH_RESEND_FROM,
  env.AUTH_RESEND_FROM_NAME,
);

type SendGolfEmailInput = {
  to: string[];
  subject: string;
  body: string;
};

export type GolfEmailResult = {
  mode: "console" | "resend";
  recipients: string[];
  providerMessageId: string | null;
  error: string | null;
};

export async function sendGolfTournamentEmail(input: SendGolfEmailInput) {
  const recipients = Array.from(
    new Set(input.to.map(normalizeEmail).filter(Boolean)),
  );

  if (recipients.length === 0) {
    return {
      mode: "resend" as const,
      recipients,
      providerMessageId: null,
      error: "No recipients were provided.",
    } satisfies GolfEmailResult;
  }

  if (!isResendConfigured()) {
    console.info(
      `[golf-email:console] ${input.subject} -> ${recipients.join(", ")}\n${input.body}`,
    );
    return {
      mode: "console" as const,
      recipients,
      providerMessageId: null,
      error: null,
    } satisfies GolfEmailResult;
  }

  const response = await resend.emails.send({
    from,
    to: recipients,
    subject: input.subject,
    text: input.body,
    html: markdownishToHtml(input.body),
  });

  if (response.error) {
    console.error("[golf-email:error]", response.error);
  }

  const providerMessageId = response.data?.id ?? null;
  return {
    mode: "resend" as const,
    recipients,
    providerMessageId,
    error:
      response.error?.message ??
      (providerMessageId ? null : "Email provider returned no message id."),
  } satisfies GolfEmailResult;
}
