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
  AUTH_RESEND_FROM_NAME:
    process.env.AUTH_RESEND_FROM_NAME ?? "Beverly Softball",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  GOLF_TOURNAMENT_CONTACT_EMAIL:
    process.env.GOLF_TOURNAMENT_CONTACT_EMAIL ?? "mishlambert10@gmail.com",
  GOLF_TOURNAMENT_ADMIN_EMAILS:
    process.env.GOLF_TOURNAMENT_ADMIN_EMAILS ?? "mishlambert10@gmail.com",
  GOLF_ADMIN_PASSWORD: process.env.GOLF_ADMIN_PASSWORD ?? "",
  GOLF_ADMIN_SESSION_SECRET: process.env.GOLF_ADMIN_SESSION_SECRET ?? "",
  CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? "",
  CLOUDFLARE_R2_ACCESS_KEY_ID:
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
  CLOUDFLARE_R2_SECRET_ACCESS_KEY:
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET ?? "",
  CLOUDFLARE_R2_PUBLIC_BASE_URL:
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ?? "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
  TWILIO_STATUS_CALLBACK_URL: process.env.TWILIO_STATUS_CALLBACK_URL ?? "",
};

export function isResendConfigured() {
  return Boolean(env.RESEND_API_KEY && env.AUTH_RESEND_FROM);
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function isStripeConfigured() {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function isR2Configured() {
  return Boolean(
    env.CLOUDFLARE_R2_ACCOUNT_ID &&
      env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      env.CLOUDFLARE_R2_BUCKET,
  );
}

export function isTwilioConfigured() {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_FROM_NUMBER,
  );
}
