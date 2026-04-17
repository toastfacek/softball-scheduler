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
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
  TWILIO_STATUS_CALLBACK_URL: process.env.TWILIO_STATUS_CALLBACK_URL ?? "",
};

export function isResendConfigured() {
  return Boolean(env.RESEND_API_KEY && env.AUTH_RESEND_FROM);
}

export function isTwilioConfigured() {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_FROM_NUMBER,
  );
}
