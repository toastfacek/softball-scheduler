import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

type RsvpTokenPayload = {
  gid: string;
  eid: string;
  exp: number;
};

export type RsvpTokenClaims = {
  guardianId: string;
  eventId: string;
  expiresAt: Date;
};

const DEFAULT_TTL_SECONDS = 72 * 60 * 60;

export function signRsvpToken(args: {
  guardianId: string;
  eventId: string;
  ttlSeconds?: number;
}) {
  const ttl = args.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const payload: RsvpTokenPayload = {
    gid: args.guardianId,
    eid: args.eventId,
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyRsvpToken(token: string): RsvpTokenClaims | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  if (!constantTimeEqual(signature, expected)) return null;

  let payload: RsvpTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as RsvpTokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.gid !== "string" ||
    typeof payload.eid !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  const expiresAt = new Date(payload.exp * 1000);
  if (expiresAt.getTime() <= Date.now()) return null;

  return { guardianId: payload.gid, eventId: payload.eid, expiresAt };
}

export function rsvpUrl(token: string, status?: "AVAILABLE" | "MAYBE" | "UNAVAILABLE") {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const qs = status ? `?s=${status}` : "";
  return `${base}/rsvp/${token}${qs}`;
}

function sign(value: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
