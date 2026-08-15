import { z } from "zod";

import { env, isTurnstileConfigured } from "@/lib/env";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "in_kind_donation";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export async function verifyInKindTurnstileToken(
  token: string,
  remoteIp?: string | null,
) {
  if (!isTurnstileConfigured() || !token) {
    return { success: false, reason: "not-configured-or-missing" as const };
  }

  const requestBody = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });

  if (remoteIp) {
    requestBody.set("remoteip", remoteIp);
  }

  let response: Response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: requestBody,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[turnstile] verification request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, reason: "provider-unavailable" as const };
  }

  if (!response.ok) {
    console.error("[turnstile] verification returned an HTTP error", {
      status: response.status,
    });
    return { success: false, reason: "provider-error" as const };
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    console.error("[turnstile] verification response was not JSON");
    return { success: false, reason: "invalid-provider-response" as const };
  }

  const parsed = turnstileResponseSchema.safeParse(responseBody);
  if (!parsed.success) {
    console.error("[turnstile] verification response was invalid");
    return { success: false, reason: "invalid-provider-response" as const };
  }

  const expectedHostname = getExpectedHostname();
  const validHostname =
    Boolean(expectedHostname) && parsed.data.hostname === expectedHostname;

  return {
    success:
      parsed.data.success &&
      parsed.data.action === TURNSTILE_ACTION &&
      validHostname,
    reason: "rejected" as const,
  };
}

function getExpectedHostname() {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).hostname;
  } catch {
    return null;
  }
}
