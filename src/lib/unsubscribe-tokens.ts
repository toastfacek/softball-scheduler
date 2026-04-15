import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

type UnsubscribeTokenPayload = {
  uid: string;
  ch: "TEXT";
};

export type UnsubscribeTokenClaims = {
  userId: string;
  channel: "TEXT";
};

export function signUnsubscribeToken(args: { userId: string }) {
  const payload: UnsubscribeTokenPayload = { uid: args.userId, ch: "TEXT" };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyUnsubscribeToken(
  token: string,
): UnsubscribeTokenClaims | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  if (!constantTimeEqual(signature, expected)) return null;

  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as UnsubscribeTokenPayload;
    if (typeof payload.uid !== "string" || payload.ch !== "TEXT") return null;
    return { userId: payload.uid, channel: payload.ch };
  } catch {
    return null;
  }
}

export function textsOffUrl(token: string) {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/texts/off/${token}`;
}

function sign(value: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
