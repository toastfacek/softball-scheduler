"use client";

import { useActionState } from "react";

import { requestMagicLinkAction } from "@/actions/auth-actions";
import { SubmitButton } from "@/components/submit-button";

export function SignInForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [state, action] = useActionState(requestMagicLinkAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          placeholder="coach@example.com"
          autoComplete="email"
          required
        />
      </div>

      {state.error ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_24%,white)] bg-[color-mix(in_srgb,var(--danger)_10%,white)] px-3 py-2 text-sm text-[color-mix(in_srgb,var(--danger)_86%,black)]">
          {state.error}
        </div>
      ) : null}

      <SubmitButton label="Email me a magic link" className="w-full" />
    </form>
  );
}
