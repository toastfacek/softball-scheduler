"use client";

import { useState } from "react";

import { updatePlayerAction } from "@/actions/team-actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { ContactActions } from "@/components/contact-actions";
import { SubmitButton } from "@/components/submit-button";

export type RosterPlayer = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  jerseyNumber: number | null;
  guardians: {
    userId: string;
    name: string | null;
    email: string;
    phone: string | null;
    relationshipLabel: string;
    sortOrder: number;
  }[];
};

export function RosterSection({
  roster,
  showContacts,
  canEdit,
}: {
  roster: RosterPlayer[];
  showContacts: boolean;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<RosterPlayer | null>(null);

  const showJerseyColumn = roster.some((p) => p.jerseyNumber != null);

  // Columns: [jersey?] [name] [guardians] [edit?]
  const gridTemplateColumns = [
    showJerseyColumn ? "52px" : null,
    "minmax(0, 1fr)",
    "minmax(0, 1.4fr)",
    canEdit ? "36px" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section>
      <SectionHead label="Roster" count={roster.length} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          border:
            "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
          borderRadius: "1rem",
          overflow: "hidden",
          background: "var(--paper)",
        }}
      >
        {roster.map((player, i) => (
          <div
            key={player.id}
            style={{
              display: "grid",
              gridTemplateColumns,
              alignItems: "center",
              gap: "1rem",
              padding: "0.75rem 1rem",
              borderBottom:
                i === roster.length - 1
                  ? "none"
                  : "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
            }}
          >
            {showJerseyColumn ? (
              <div
                style={{
                  fontFamily: "var(--font-barlow-condensed), sans-serif",
                  fontWeight: 700,
                  fontSize: "1.75rem",
                  lineHeight: 1,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  color:
                    player.jerseyNumber != null
                      ? "var(--navy-strong)"
                      : "color-mix(in srgb, var(--navy) 30%, white)",
                }}
              >
                {player.jerseyNumber ?? ""}
              </div>
            ) : null}
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "var(--navy-strong)",
                  letterSpacing: "-0.005em",
                }}
              >
                {player.displayName}
              </div>
              {player.displayName.toLowerCase() !==
              `${player.firstName} ${player.lastName}`.toLowerCase() ? (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "color-mix(in srgb, var(--navy) 52%, white)",
                    marginTop: "0.1rem",
                  }}
                >
                  {player.firstName} {player.lastName}
                </div>
              ) : null}
            </div>
            <div
              style={{
                fontSize: "0.82rem",
                color: "color-mix(in srgb, var(--navy) 72%, white)",
                lineHeight: 1.4,
              }}
            >
              {player.guardians.length === 0 ? (
                <span
                  style={{
                    color: "color-mix(in srgb, var(--navy) 40%, white)",
                    fontStyle: "italic",
                  }}
                >
                  No guardian linked
                </span>
              ) : (
                player.guardians.map((g, idx) => (
                  <span
                    key={g.userId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {g.name ?? g.email.split("@")[0]}
                    </span>
                    {showContacts ? (
                      <ContactActions
                        phone={g.phone}
                        name={g.name ?? g.email.split("@")[0]}
                      />
                    ) : null}
                    {idx < player.guardians.length - 1 ? (
                      <span
                        style={{
                          margin: "0 0.4rem",
                          color:
                            "color-mix(in srgb, var(--navy) 25%, white)",
                        }}
                      >
                        ·
                      </span>
                    ) : null}
                  </span>
                ))
              )}
            </div>
            {canEdit ? (
              <button
                type="button"
                className="contact-icon-btn"
                aria-label={`Edit ${player.displayName}`}
                onClick={() => setEditing(player)}
              >
                <PencilIcon />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.displayName}` : undefined}
      >
        {editing ? (
          <form
            action={async (formData) => {
              await updatePlayerAction(formData);
              setEditing(null);
            }}
            className="team-add-fields"
          >
            <input type="hidden" name="playerId" value={editing.id} />
            <Field label="Preferred name" htmlFor="edit-preferredName">
              <input
                id="edit-preferredName"
                name="preferredName"
                defaultValue={editing.preferredName ?? ""}
                placeholder={editing.firstName}
              />
            </Field>
            <Field label="Jersey" htmlFor="edit-jerseyNumber">
              <input
                id="edit-jerseyNumber"
                name="jerseyNumber"
                type="number"
                min="0"
                max="99"
                defaultValue={editing.jerseyNumber ?? ""}
              />
            </Field>
            <SubmitButton label="Save changes" />
          </form>
        ) : null}
      </BottomSheet>
    </section>
  );
}

function SectionHead({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: "0.625rem",
        paddingBottom: "0.375rem",
        borderBottom:
          "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-barlow-condensed), sans-serif",
          fontWeight: 700,
          fontSize: "1.2rem",
          letterSpacing: "0.02em",
          color: "var(--navy-strong)",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {label}
      </h2>
      <span
        style={{
          fontFamily: "var(--font-barlow-condensed), sans-serif",
          fontWeight: 700,
          fontSize: "0.95rem",
          fontVariantNumeric: "tabular-nums",
          color: "color-mix(in srgb, var(--navy) 52%, white)",
        }}
      >
        {count}
      </span>
    </div>
  );
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

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
