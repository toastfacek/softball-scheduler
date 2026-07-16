import { createHash, randomBytes } from "crypto";

export function createCompletionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCompletionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function completionTokenExpiry() {
  const expiresAt = new Date("2026-10-28T23:59:59-04:00");
  return expiresAt;
}
