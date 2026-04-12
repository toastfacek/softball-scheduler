"use client";

import { useActionState } from "react";

import { requestMagicLinkAction } from "@/actions/auth-actions";
import { SubmitButton } from "@/components/submit-button";

export function SignInForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [state, action] = useActionState(requestMagicLinkAction, {});

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email">Invited email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          placeholder="parent@example.com"
          autoComplete="email"
          required
        />
        <p className="text-sm text-[color-mix(in_srgb,var(--navy)_70%,white)]">
          Enter the email a coach or team admin added to the roster.
        </p>
      </div>

      {state.error ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_24%,white)] bg-[color-mix(in_srgb,var(--danger)_10%,white)] px-4 py-3 text-sm text-[color-mix(in_srgb,var(--danger)_86%,black)]">
          {state.error}
        </div>
      ) : null}

      <SubmitButton label="Email me a magic link" className="w-full" />
    </form>
  );
}
