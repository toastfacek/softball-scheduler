export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/softball",
  AUTH_SECRET:
    process.env.AUTH_SECRET ?? "development-secret-change-before-production",
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  AUTH_RESEND_FROM:
    process.env.AUTH_RESEND_FROM ?? "BGSL <hello@example.com>",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
};

export function isResendConfigured() {
  return Boolean(env.RESEND_API_KEY && env.AUTH_RESEND_FROM);
}

