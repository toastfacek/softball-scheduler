import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";

const GOLF_ADMIN_COOKIE = "bgsl_golf_admin";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export function isGolfAdminConfigured() {
  return Boolean(env.GOLF_ADMIN_PASSWORD && env.GOLF_ADMIN_SESSION_SECRET);
}

export function verifyGolfAdminPassword(candidate: string) {
  if (!isGolfAdminConfigured()) return false;

  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256")
    .update(env.GOLF_ADMIN_PASSWORD)
    .digest();

  return timingSafeEqual(candidateDigest, expectedDigest);
}

export async function createGolfAdminSession() {
  if (!isGolfAdminConfigured()) {
    throw new Error("Golf admin authentication is not configured.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const token = `${expiresAt}.${signExpiration(expiresAt)}`;
  const cookieStore = await cookies();

  cookieStore.set(GOLF_ADMIN_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearGolfAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(GOLF_ADMIN_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function hasGolfAdminSession() {
  if (!isGolfAdminConfigured()) return false;

  const token = (await cookies()).get(GOLF_ADMIN_COOKIE)?.value;
  if (!token) return false;

  const [expirationValue, suppliedSignature, ...extraParts] = token.split(".");
  if (!expirationValue || !suppliedSignature || extraParts.length > 0) {
    return false;
  }

  const expiresAt = Number(expirationValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() / 1000) {
    return false;
  }

  const expectedSignature = signExpiration(expiresAt);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

export async function requireGolfAdmin() {
  if (!(await hasGolfAdminSession())) {
    redirect("/golf-admin/login");
  }
}

function signExpiration(expiresAt: number) {
  return createHmac("sha256", env.GOLF_ADMIN_SESSION_SECRET)
    .update(`golf-admin:${expiresAt}`)
    .digest("base64url");
}
