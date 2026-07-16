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

export async function sendGolfTournamentEmail(input: SendGolfEmailInput) {
  const recipients = Array.from(
    new Set(input.to.map(normalizeEmail).filter(Boolean)),
  );

  if (recipients.length === 0) {
    return null;
  }

  if (!isResendConfigured()) {
    console.info(
      `[golf-email:console] ${input.subject} -> ${recipients.join(", ")}\n${input.body}`,
    );
    return { mode: "console" as const, recipients };
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

  return response;
}
