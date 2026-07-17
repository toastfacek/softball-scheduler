"use client";

import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { updateEventAction } from "@/actions/event-actions";
import { BottomSheet } from "@/components/bottom-sheet";

type Props = {
  originalStartsAt: string;
  originalType: string;
  originalStatus: string;
  className?: string;
  children: ReactNode;
};

export function EditEventForm({
  originalStartsAt,
  originalType,
  originalStatus,
  className,
  children,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showSheet, setShowSheet] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;

    // Already made a choice — let the submission through.
    const existingChoice = (
      form.elements.namedItem("resetRsvps") as HTMLInputElement | null
    )?.value;
    if (existingChoice) return;

    // COMPLETED events are guarded server-side; skip client prompt.
    if (originalStatus === "COMPLETED") return;

    const newStartsAt =
      (form.elements.namedItem("startsAt") as HTMLInputElement)?.value ?? "";
    const newType =
      (form.elements.namedItem("type") as HTMLSelectElement)?.value ?? "";
    const newStatus =
      (form.elements.namedItem("status") as HTMLSelectElement)?.value ?? "";

    const rsvpFieldChanged =
      newStartsAt !== originalStartsAt ||
      newType !== originalType ||
      newStatus !== originalStatus;

    if (rsvpFieldChanged) {
      e.preventDefault();
      setShowSheet(true);
    }
  }

  function submitWithChoice(resetRsvps: boolean) {
    setShowSheet(false);
    const form = formRef.current;
    if (!form) return;
    let input = form.querySelector<HTMLInputElement>('input[name="resetRsvps"]');
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "resetRsvps";
      form.appendChild(input);
    }
    input.value = String(resetRsvps);
    form.requestSubmit();
  }

  return (
    <>
      <form
        ref={formRef}
        action={updateEventAction}
        onSubmit={handleSubmit}
        className={className}
      >
        {children}
      </form>
      <BottomSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
        title="Also reset RSVPs?"
      >
        <p className="px-4 pb-3 text-sm opacity-75">
          You changed the time, type, or status. Clear existing RSVPs so
          people can re-confirm, or keep them as-is.
        </p>
        <div className="flex flex-col gap-2 px-4 pb-6">
          <button
            type="button"
            className="btn-primary btn-block"
            onClick={() => submitWithChoice(true)}
          >
            Clear RSVPs
          </button>
          <button
            type="button"
            className="btn-secondary btn-block"
            onClick={() => submitWithChoice(false)}
          >
            Keep RSVPs
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
