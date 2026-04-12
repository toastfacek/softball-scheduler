"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { normalizeEmail } from "@/lib/utils";

type AuthActionState = {
  error?: string;
};

export async function requestMagicLinkAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!email) {
    return {
      error: "Enter the email that was invited to the team.",
    };
  }

  try {
    await signIn("resend", {
      email,
      redirectTo: "/schedule",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "That email is not on the roster yet. Ask a coach or team admin to invite you first.",
      };
    }

    throw error;
  }

  return {};
}

export async function signOutAction() {
  await signOut({
    redirectTo: "/sign-in",
  });
}
