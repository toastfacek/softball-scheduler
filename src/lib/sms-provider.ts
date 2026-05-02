import Twilio from "twilio";

import { env, isTwilioConfigured } from "@/lib/env";

type SendSmsResult =
  | {
      status: "SENT";
      providerMessageId: string | null;
      errorMessage: null;
    }
  | {
      status: "FAILED";
      providerMessageId: null;
      errorMessage: string;
    }
  | {
      status: "CONSOLE_FALLBACK";
      providerMessageId: string;
      errorMessage: null;
    };

let cachedClient: ReturnType<typeof Twilio> | null = null;

function client() {
  if (cachedClient) return cachedClient;
  cachedClient = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return cachedClient;
}

export async function sendSms({
  to,
  body,
  statusCallbackUrl,
}: {
  to: string;
  body: string;
  statusCallbackUrl?: string;
}): Promise<SendSmsResult> {
  if (!isTwilioConfigured()) {
    console.info(`[sms:console] ${to}\n${body}`);
    return {
      status: "CONSOLE_FALLBACK",
      providerMessageId: `console-${Date.now()}-${to}`,
      errorMessage: null,
    };
  }

  try {
    const message = await client().messages.create({
      to,
      from: env.TWILIO_FROM_NUMBER,
      body,
      ...(statusCallbackUrl ?? env.TWILIO_STATUS_CALLBACK_URL
        ? { statusCallback: statusCallbackUrl ?? env.TWILIO_STATUS_CALLBACK_URL }
        : {}),
    });

    return {
      status: "SENT",
      providerMessageId: message.sid,
      errorMessage: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Twilio send failed.";
    return {
      status: "FAILED",
      providerMessageId: null,
      errorMessage: message,
    };
  }
}
