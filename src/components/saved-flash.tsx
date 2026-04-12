"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ConfirmModal } from "@/components/confirm-modal";

const COPY: Record<string, { title: string; body: string }> = {
  event: { title: "Event created", body: "Your team can now RSVP." },
  "event-edit": {
    title: "Event updated",
    body: "Guardians will see the changes.",
  },
  rsvp: {
    title: "RSVP saved",
    body: "Coaches can see your response.",
  },
  lineup: {
    title: "Lineup saved",
    body: "Batting order and positions are set.",
  },
  profile: { title: "Profile saved", body: "Your account details were updated." },
  broadcast: {
    title: "Broadcast sent",
    body: "All recipients will receive your message shortly.",
  },
  email: {
    title: "Email sent",
    body: "Guardians will receive your update shortly.",
  },
};

/**
 * Reads `?saved=<kind>` from the URL and pops a confirmation modal once.
 * Closing clears the query param so refresh doesn't re-show it.
 * Drop into any page that's the redirect target of a save action.
 */
export function SavedFlash() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const saved = params.get("saved");
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (!saved || !COPY[saved]) return null;
  const open = saved !== dismissedFor;
  const copy = COPY[saved];

  return (
    <ConfirmModal
      open={open}
      title={copy.title}
      body={copy.body}
      onClose={() => {
        setDismissedFor(saved);
        const next = new URLSearchParams(params.toString());
        next.delete("saved");
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
    />
  );
}
