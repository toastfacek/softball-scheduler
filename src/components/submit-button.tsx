"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
};

export function SubmitButton({
  label,
  pendingLabel,
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center rounded-[1rem] border border-[color-mix(in_srgb,var(--orange-strong)_72%,black)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--orange)_94%,white),var(--orange-strong))] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[var(--navy-strong)] shadow-[0_16px_34px_color-mix(in_srgb,var(--orange-strong)_24%,transparent)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_color-mix(in_srgb,var(--orange-strong)_28%,transparent)] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {pending ? pendingLabel || `${label}...` : label}
    </button>
  );
}
