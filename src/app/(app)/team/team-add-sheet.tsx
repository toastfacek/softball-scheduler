"use client";

import { useState } from "react";

import {
  addGuardianAction,
  addStaffRoleAction,
  createPlayerAction,
} from "@/actions/team-actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { SubmitButton } from "@/components/submit-button";

type PlayerOption = { id: string; displayName: string };

type Segment = "player" | "guardian" | "staff";

const SEG_TITLE: Record<Segment, string> = {
  player: "Add player",
  guardian: "Invite guardian",
  staff: "Invite staff",
};

export function TeamAddSheet({
  players,
  initial,
}: {
  players: PlayerOption[];
  initial?: Segment;
}) {
  const [open, setOpen] = useState(false);
  const [seg, setSeg] = useState<Segment>(initial ?? "player");

  const close = () => setOpen(false);
  const openAs = (s: Segment) => {
    setSeg(s);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn icon-btn--primary"
        aria-label="Add to team"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
      </button>

      <BottomSheet open={open} onClose={close} title={SEG_TITLE[seg]}>
        <div className="team-segmented">
          {(["player", "guardian", "staff"] as Segment[]).map((s) => (
            <button
              key={s}
              type="button"
              className={seg === s ? "team-seg-active" : ""}
              onClick={() => setSeg(s)}
            >
              {s === "player" ? "Player" : s === "guardian" ? "Guardian" : "Staff"}
            </button>
          ))}
        </div>

        {seg === "player" ? (
          <form action={createPlayerAction} className="team-add-fields">
            <div className="grid grid-cols-2 gap-2">
              <Field label="First name" htmlFor="firstName">
                <input id="firstName" name="firstName" required />
              </Field>
              <Field label="Last name" htmlFor="lastName">
                <input id="lastName" name="lastName" required />
              </Field>
            </div>
            <Field label="Preferred name" htmlFor="preferredName">
              <input id="preferredName" name="preferredName" />
            </Field>
            <Field label="Jersey" htmlFor="jerseyNumber">
              <input
                id="jerseyNumber"
                name="jerseyNumber"
                type="number"
                min="0"
                max="99"
              />
            </Field>
            <SubmitButton label="Add player" />
          </form>
        ) : null}

        {seg === "guardian" ? (
          <form action={addGuardianAction} className="team-add-fields">
            <Field label="Player" htmlFor="playerId">
              <select id="playerId" name="playerId" required>
                <option value="">Select a player</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Guardian name" htmlFor="guardianName">
              <input id="guardianName" name="name" required />
            </Field>
            <Field label="Email" htmlFor="guardianEmail">
              <input id="guardianEmail" name="email" type="email" required />
            </Field>
            <Field label="Phone" htmlFor="guardianPhone">
              <input id="guardianPhone" name="phone" type="tel" />
            </Field>
            <Field label="Relationship" htmlFor="relationshipLabel">
              <input
                id="relationshipLabel"
                name="relationshipLabel"
                defaultValue="Guardian"
              />
            </Field>
            <label className="team-checkbox">
              <input type="checkbox" name="sendInvite" defaultChecked />
              Send an invitation email now
            </label>
            <SubmitButton label="Invite guardian" />
          </form>
        ) : null}

        {seg === "staff" ? (
          <form action={addStaffRoleAction} className="team-add-fields">
            <Field label="Name" htmlFor="staffName">
              <input id="staffName" name="name" required />
            </Field>
            <Field label="Email" htmlFor="staffEmail">
              <input id="staffEmail" name="email" type="email" required />
            </Field>
            <Field label="Phone" htmlFor="staffPhone">
              <input id="staffPhone" name="phone" type="tel" />
            </Field>
            <Field label="Role" htmlFor="role">
              <select id="role" name="role" defaultValue="COACH">
                <option value="COACH">Coach</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
            <label className="team-checkbox">
              <input type="checkbox" name="sendInvite" defaultChecked />
              Send an invitation email now
            </label>
            <SubmitButton label="Invite staff" />
          </form>
        ) : null}
      </BottomSheet>

      {/* Programmatic openers so sections can trigger the right segment. */}
      <OpenerBridge onOpen={openAs} />
    </>
  );
}

/**
 * Exposes a window-level helper so server-rendered section headers can
 * dispatch a custom event to open the sheet on the right segment without
 * needing to be turned into client components themselves.
 */
function OpenerBridge({ onOpen }: { onOpen: (s: Segment) => void }) {
  if (typeof window !== "undefined") {
    (window as unknown as { __bgslTeamAdd?: (s: Segment) => void }).__bgslTeamAdd = onOpen;
  }
  return null;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
