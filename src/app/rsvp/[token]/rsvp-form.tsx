"use client";

import { useEffect, useState, useTransition } from "react";

import {
  recordRsvpFromLinkAction,
  type RsvpFromLinkResult,
} from "@/actions/event-actions";

type Status = "AVAILABLE" | "MAYBE" | "UNAVAILABLE";

type PlayerInput = {
  id: string;
  name: string;
  currentStatus: Status | null;
  currentNote: string | null;
};

type PendingSubmission = {
  status: Status;
  targetPlayerIds?: string[];
};

const STATUS_LABELS: Record<Status, string> = {
  AVAILABLE: "Yes, they're in",
  MAYBE: "Maybe",
  UNAVAILABLE: "Can't make it",
};

export function RsvpForm({
  token,
  players,
  preselectStatus,
}: {
  token: string;
  players: PlayerInput[];
  preselectStatus: Status | null;
}) {
  const singlePlayer = players.length === 1;
  const [perPlayer, setPerPlayer] = useState<Record<string, Status | null>>(
    () => {
      const initial: Record<string, Status | null> = {};
      for (const p of players) initial[p.id] = p.currentStatus;
      return initial;
    },
  );
  const [note, setNote] = useState<string>(players[0]?.currentNote ?? "");
  const [applyToAll, setApplyToAll] = useState<boolean>(true);
  const [result, setResult] = useState<RsvpFromLinkResult | null>(null);
  const [pendingSubmission, setPendingSubmission] =
    useState<PendingSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-submit on first render if a status was preselected via ?s=...
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  useEffect(() => {
    if (autoSubmitted || !preselectStatus) return;
    setAutoSubmitted(true);
    if (preselectStatus === "AVAILABLE") {
      submit(preselectStatus);
    } else {
      setPendingSubmission({ status: preselectStatus });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectStatus(status: Status, targetPlayerIds?: string[]) {
    if (status === "AVAILABLE") {
      submit(status, targetPlayerIds);
      return;
    }

    setResult(null);
    setError(null);
    setPendingSubmission({ status, targetPlayerIds });
  }

  function submit(status: Status, targetPlayerIds?: string[]) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await recordRsvpFromLinkAction({
          token,
          status,
          note: note || undefined,
          playerIds: targetPlayerIds,
        });
        setResult(res);
        setPendingSubmission(null);
        const next: Record<string, Status | null> = { ...perPlayer };
        for (const id of res.updated.map((u) => u.playerId)) next[id] = status;
        setPerPlayer(next);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      }
    });
  }

  function pendingStatusFor(playerId: string) {
    if (!pendingSubmission) return null;
    if (!pendingSubmission.targetPlayerIds) return pendingSubmission.status;
    return pendingSubmission.targetPlayerIds.includes(playerId)
      ? pendingSubmission.status
      : null;
  }

  if (result && !error) {
    const statusLabel =
      result.status === "AVAILABLE"
        ? "available"
        : result.status === "MAYBE"
          ? "as maybe"
          : "unavailable";
    const names = result.updated.map((u) => u.playerName.split(" ")[0]);
    const namesText =
      names.length === 1
        ? names[0]
        : names.length === 2
          ? names.join(" & ")
          : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

    return (
      <section className="rsvp-card">
        <div className="rsvp-success">
          <div className="rsvp-check">
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h2 className="rsvp-success-title">Got it — thanks!</h2>
            <p className="rsvp-success-body">
              {namesText} marked {statusLabel}.
            </p>
          </div>
        </div>

        <p className="rsvp-change-intro">Change your mind?</p>
        <StatusButtons
          disabled={isPending}
          activeStatus={result.status}
          onSelect={(s) => selectStatus(s)}
        />
      </section>
    );
  }

  const pendingStatus = pendingSubmission?.status ?? null;

  return (
    <section className="rsvp-card">
      {singlePlayer ? (
        <>
          <p className="rsvp-prompt">
            Will <strong>{players[0].name.split(" ")[0]}</strong> make it?
          </p>
          <StatusButtons
            disabled={isPending}
            activeStatus={
              pendingStatusFor(players[0].id) ??
              perPlayer[players[0].id] ??
              null
            }
            onSelect={(s) => selectStatus(s, [players[0].id])}
          />
        </>
      ) : (
        <>
          <p className="rsvp-prompt">
            You have {players.length} players on the team. Pick a status for
            each, or apply one choice to everyone.
          </p>

          <label className="rsvp-toggle">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            <span>Apply one answer to all of my kids</span>
          </label>

          {applyToAll ? (
            <StatusButtons
              disabled={isPending}
              activeStatus={
                pendingSubmission && !pendingSubmission.targetPlayerIds
                  ? pendingSubmission.status
                  : null
              }
              onSelect={(s) => selectStatus(s)}
            />
          ) : (
            <div className="rsvp-player-grid">
              {players.map((p) => (
                <div key={p.id} className="rsvp-player-row">
                  <div className="rsvp-player-name">{p.name}</div>
                  <StatusButtons
                    disabled={isPending}
                    activeStatus={
                      pendingStatusFor(p.id) ?? perPlayer[p.id] ?? null
                    }
                    onSelect={(s) => selectStatus(s, [p.id])}
                    compact
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="rsvp-note-field">
        <label htmlFor="rsvp-note">
          {pendingStatus === "UNAVAILABLE"
            ? "Why can't they make it? (optional)"
            : pendingStatus === "MAYBE"
              ? "What should coaches know? (optional)"
              : "Add a note (optional)"}
        </label>
        <textarea
          id="rsvp-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Running late, leaving early…"
        />
      </div>

      {pendingSubmission ? (
        <button
          type="button"
          className="rsvp-submit"
          disabled={isPending}
          onClick={() =>
            submit(pendingSubmission.status, pendingSubmission.targetPlayerIds)
          }
        >
          Save RSVP
        </button>
      ) : null}

      {error ? <p className="rsvp-error">{error}</p> : null}
      {isPending ? <p className="rsvp-status">Saving…</p> : null}
    </section>
  );
}

function StatusButtons({
  activeStatus,
  disabled,
  onSelect,
  compact = false,
}: {
  activeStatus: Status | null;
  disabled: boolean;
  onSelect: (s: Status) => void;
  compact?: boolean;
}) {
  const statuses: Status[] = ["AVAILABLE", "MAYBE", "UNAVAILABLE"];
  return (
    <div className={compact ? "rsvp-buttons rsvp-buttons--compact" : "rsvp-buttons"}>
      {statuses.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(s)}
          className={`rsvp-btn rsvp-btn--${s.toLowerCase()}${
            activeStatus === s ? " rsvp-btn--active" : ""
          }`}
        >
          {compact ? (s === "AVAILABLE" ? "Yes" : s === "MAYBE" ? "Maybe" : "No") : STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
