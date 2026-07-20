"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  clearGolfAdminSession,
  createGolfAdminSession,
  isGolfAdminConfigured,
  requireGolfAdmin,
  verifyGolfAdminPassword,
} from "@/lib/golf-tournament/admin-auth";
import { sendGolfConfirmationPreview } from "@/lib/golf-tournament/confirmation-email";

const passwordSchema = z.string().min(1).max(256);

export async function signInGolfAdminAction(formData: FormData) {
  if (!isGolfAdminConfigured()) {
    redirect("/golf-admin/login?error=setup");
  }

  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success || !verifyGolfAdminPassword(parsed.data)) {
    redirect("/golf-admin/login?error=invalid");
  }

  await createGolfAdminSession();
  redirect("/golf-admin");
}

export async function signOutGolfAdminAction() {
  await clearGolfAdminSession();
  redirect("/golf-admin/login");
}

export async function sendGolfConfirmationPreviewAction() {
  await requireGolfAdmin();
  await sendGolfConfirmationPreview("mishlambert10@gmail.com");
  redirect("/golf-admin/email-preview?sent=1");
}
