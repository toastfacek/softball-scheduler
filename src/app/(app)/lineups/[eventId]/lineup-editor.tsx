"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import {
  loadLineupPresetPayload,
  saveLineupAction,
  saveLineupPresetAction,
} from "@/actions/lineup-actions";

type Availability = "AVAILABLE" | "MAYBE" | "UNAVAILABLE" | null;

type PlayerSeed = {
  id: string;
  name: string;
  availability: Availability;
};

type Position = { code: string; label: string };
type PresetSummary = { id: string; name: string };

type Props = {
  // Event-mode props (set together). When eventId is undefined, editor is in
  // preset mode; when eventId is set, editor is editing a game lineup.
  eventId?: string;
  eventTitle: string;
  presets?: PresetSummary[];

  // Preset-mode props.
  presetId?: string;
  initialPresetName?: string;

  initialInnings: number;
  initialBattingOrder: string[];
  initialAssignments: Record<string, string[]>;
  players: PlayerSeed[];
  positions: Position[];
};

const FIELD_COORDS: Record<string, { x: number; y: number }> = {
  P: { x: 130, y: 105 },
  C: { x: 130, y: 160 },
  "1B": { x: 195, y: 100 },
  "2B": { x: 160, y: 70 },
  "3B": { x: 65, y: 100 },
  SS: { x: 100, y: 70 },
  LF: { x: 50, y: 48 },
  LCF: { x: 100, y: 28 },
  RCF: { x: 160, y: 28 },
  RF: { x: 210, y: 48 },
};

export function LineupEditor({
  eventId,
  eventTitle,
  presets,
  presetId,
  initialPresetName,
  initialInnings,
  initialBattingOrder,
  initialAssignments,
  players,
  positions,
}: Props) {
  const isPresetMode = !eventId;
  const [innings, setInnings] = useState(initialInnings);
  const [battingOrder, setBattingOrder] = useState(initialBattingOrder);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedInning, setSelectedInning] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [presetName, setPresetName] = useState(initialPresetName ?? "");
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null);
  const lineupPlayers = useMemo(
    () =>
      isPresetMode
        ? players
        : players.filter((player) => player.availability !== "UNAVAILABLE"),
    [isPresetMode, players],
  );
  const unavailablePlayers = useMemo(
    () =>
      isPresetMode
        ? []
        : players.filter((player) => player.availability === "UNAVAILABLE"),
    [isPresetMode, players],
  );

  async function applyPreset(pid: string) {
    if (!pid) return;
    setLoadingPresetId(pid);
    try {
      const payload = await loadLineupPresetPayload(pid);
      if (!payload) return;

      // The preset may be out of sync with the current roster: players on the
      // team that weren't in the preset get appended at the end with default
      // bench assignments, and players in the preset who are no longer on the
      // team are dropped. This keeps the save action's "every batting slot
      // must be filled" invariant true even when rosters have moved on.
      const currentIds = new Set(lineupPlayers.map((p) => p.id));
      const presetIds = new Set(payload.battingOrder);
      const validPresetOrder = payload.battingOrder.filter((id) =>
        currentIds.has(id),
      );
      const missing = lineupPlayers
        .filter((p) => !presetIds.has(p.id))
        .map((p) => p.id);
      const mergedOrder = [...validPresetOrder, ...missing];

      setInnings(payload.inningsCount);
      setBattingOrder(mergedOrder);

      const next: Record<string, string[]> = {};
      for (const playerId of mergedOrder) {
        next[playerId] = Array.from(
          { length: payload.inningsCount },
          () => "BN",
        );
      }
      for (const a of payload.assignments) {
        if (
          a.inningNumber <= payload.inningsCount &&
          next[a.playerId] != null
        ) {
          next[a.playerId][a.inningNumber - 1] = a.positionCode;
        }
      }
      setAssignments(next);

      if (missing.length > 0) {
        setSaveError(
          `Added ${missing.length} player${missing.length === 1 ? "" : "s"} who joined after this preset was saved. They're benched — assign them before saving.`,
        );
      } else {
        setSaveError(null);
      }
    } finally {
      setLoadingPresetId(null);
    }
  }

  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  const hasBenchPosition = positions.some((p) => p.code === "BN");

  function setCell(pid: string, inningIdx: number, code: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      const row = next[pid] ? [...next[pid]] : new Array(innings).fill("BN");
      row[inningIdx] = code;
      next[pid] = row;
      return next;
    });
    setSaved(false);
  }

  function reorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setBattingOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setSaved(false);
  }

  function changeInnings(newInnings: number) {
    if (newInnings < 1 || newInnings > 9) return;
    setInnings(newInnings);
    if (selectedInning > newInnings) setSelectedInning(newInnings);
    setAssignments((prev) => {
      const next: Record<string, string[]> = {};
      for (const pid of battingOrder) {
        const prevRow = prev[pid] ?? [];
        next[pid] = Array.from({ length: newInnings }, (_, i) =>
          prevRow[i] ?? (hasBenchPosition ? "BN" : positions[0]?.code ?? ""),
        );
      }
      return next;
    });
    setSaved(false);
  }

  // Duplicate detection: per inning, track non-bench codes seen
  const duplicates = useMemo(() => {
    const result: Set<string>[] = [];
    for (let i = 0; i < innings; i++) {
      const seen = new Map<string, string>();
      const dupes = new Set<string>();
      for (const pid of battingOrder) {
        const code = assignments[pid]?.[i] ?? "";
        if (!code || code === "BN") continue;
        if (seen.has(code)) {
          dupes.add(pid);
          dupes.add(seen.get(code)!);
        } else {
          seen.set(code, pid);
        }
      }
      result.push(dupes);
    }
    return result;
  }, [assignments, battingOrder, innings]);

  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    if (isPresetMode && !presetName.trim()) {
      setSaveError("Give the preset a name first.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = isPresetMode
          ? await saveLineupPresetAction(formData)
          : await saveLineupAction(formData);
        if (result?.error) {
          setSaveError(result.error);
          return;
        }
        // On success the action redirects, so this path is only hit if Next's
        // thrown redirect propagates here (which it does in RSC client calls).
        setSaved(true);
      } catch (err) {
        // Redirects are thrown by Next.js — let them flow to the router.
        if (isRedirectError(err)) throw err;
        setSaveError(
          err instanceof Error ? err.message : "Unable to save lineup.",
        );
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="page-lineup">
      {eventId ? (
        <input type="hidden" name="eventId" value={eventId} />
      ) : null}
      {presetId ? (
        <input type="hidden" name="presetId" value={presetId} />
      ) : null}
      {isPresetMode ? (
        <input type="hidden" name="name" value={presetName} />
      ) : null}
      <input type="hidden" name="inningsCount" value={innings} />
      {battingOrder.map((pid, idx) => (
        <input
          key={`slot-${idx}`}
          type="hidden"
          name={`slot:${idx + 1}`}
          value={pid}
        />
      ))}
      {battingOrder.flatMap((pid) =>
        (assignments[pid] ?? []).slice(0, innings).map((code, inIdx) => (
          <input
            key={`asgn-${pid}-${inIdx}`}
            type="hidden"
            name={`inning:${inIdx + 1}:${pid}`}
            value={code}
          />
        )),
      )}

      {/* Condensed event/preset header */}
      <section
        data-lineup="header"
        className="shell-panel rounded-tile p-3"
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <div className="relative flex items-center justify-between gap-2">
          {isPresetMode ? (
            <input
              aria-label="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name — e.g. Standard starting 9"
              style={{
                flex: "1 1 auto",
                padding: "0.5rem 0.75rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                fontFamily: "var(--font-barlow-condensed), sans-serif",
                color: "var(--navy-strong)",
                background: "transparent",
                border: "1px dashed color-mix(in srgb, var(--navy) 30%, white)",
                borderRadius: "0.5rem",
              }}
            />
          ) : (
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--navy-strong)",
                fontFamily: "var(--font-barlow-condensed), sans-serif",
              }}
            >
              {eventTitle}
            </div>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="innings" style={{ fontSize: "0.6rem" }}>
              Innings
            </label>
            <input
              id="innings"
              type="number"
              min={1}
              max={9}
              value={innings}
              onChange={(e) => changeInnings(parseInt(e.target.value, 10) || 1)}
              style={{ width: 60, padding: "0.35rem 0.5rem", fontSize: "0.85rem" }}
            />
          </div>
        </div>

        {!isPresetMode && presets && presets.length > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.8rem",
            }}
          >
            <label htmlFor="preset-picker" style={{ fontSize: "0.7rem" }}>
              Load from preset
            </label>
            <select
              id="preset-picker"
              defaultValue=""
              onChange={(e) => {
                const pid = e.target.value;
                if (pid) void applyPreset(pid);
                e.target.value = "";
              }}
              disabled={loadingPresetId !== null}
              style={{
                flex: "0 1 280px",
                padding: "0.4rem 0.6rem",
                fontSize: "0.85rem",
              }}
            >
              <option value="">
                {loadingPresetId ? "Loading…" : "Select a preset…"}
              </option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      {/* Batting order */}
      <section
        data-lineup="order"
        className="shell-panel rounded-tile p-4"
      >
        <div className="section-head" style={{ padding: 0, marginBottom: "0.5rem" }}>
          Batting order
        </div>
        <OrderList
          battingOrder={battingOrder}
          playerById={playerById}
          unavailablePlayers={unavailablePlayers}
          onReorder={reorder}
        />
      </section>

      {/* Position matrix */}
      <section
        data-lineup="matrix"
        className="shell-panel rounded-tile p-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="section-head" style={{ padding: 0 }}>
            Positions
          </div>
          <span
            style={{
              fontSize: "0.62rem",
              color: "color-mix(in srgb, var(--navy) 60%, white)",
            }}
          >
            Tap a cell to set
          </span>
        </div>
        <Matrix
          battingOrder={battingOrder}
          playerById={playerById}
          innings={innings}
          assignments={assignments}
          positions={positions}
          selectedInning={selectedInning}
          onSelectInning={setSelectedInning}
          onSetCell={setCell}
          duplicates={duplicates}
        />
      </section>

      {/* Field visualizer */}
      <section
        data-lineup="field"
        className="shell-panel rounded-tile p-3"
      >
        <div className="flex items-center justify-between mb-1">
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--navy-strong)", fontFamily: "var(--font-barlow-condensed), sans-serif" }}>
            Inning {selectedInning}
          </div>
          <span
            style={{
              fontSize: "0.6rem",
              color: "color-mix(in srgb, var(--navy) 60%, white)",
            }}
          >
            Tap an inning column
          </span>
        </div>
        <FieldViz
          battingOrder={battingOrder}
          playerById={playerById}
          assignments={assignments}
          selectedInning={selectedInning}
        />
      </section>

      <div data-lineup="save">
      {saveError ? (
        <div
          className="rsvp-error"
          role="alert"
        >
          {saveError}
        </div>
      ) : null}
      {saved ? (
        <div
          style={{
            padding: "0.625rem 0.75rem",
            borderRadius: "0.625rem",
            background: "color-mix(in srgb, var(--success) 12%, white)",
            border: "1px solid color-mix(in srgb, var(--success) 34%, white)",
            color: "color-mix(in srgb, var(--success) 80%, black)",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          ✓ Lineup saved
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary btn-block" disabled={isPending}>
          {isPending
            ? "Saving…"
            : isPresetMode
              ? presetId
                ? "Update preset"
                : "Save preset"
              : "Save lineup"}
        </button>
      </div>
      </div>
    </form>
  );
}

function OrderList({
  battingOrder,
  playerById,
  unavailablePlayers,
  onReorder,
}: {
  battingOrder: string[];
  playerById: Map<string, PlayerSeed>;
  unavailablePlayers: PlayerSeed[];
  onReorder: (fromIdx: number, toIdx: number) => void;
}) {
  const [dragPid, setDragPid] = useState<string | null>(null);
  const [startY, setStartY] = useState(0);
  const [rowHeight, setRowHeight] = useState(48);
  const [fromIdx, setFromIdx] = useState(0);
  const [translate, setTranslate] = useState(0);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, pid: string, idx: number) {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    // Measure row height from two rows if possible
    const rows = Array.from(rowRefs.current.values());
    if (rows.length > 1) {
      const r0 = rows[0].getBoundingClientRect();
      const r1 = rows[1].getBoundingClientRect();
      setRowHeight(r1.top - r0.top);
    } else {
      setRowHeight(rect.height + 6);
    }
    setDragPid(pid);
    setFromIdx(idx);
    setStartY(e.clientY);
    setTranslate(0);
  }

  function currentTargetIdx(dy: number) {
    const steps = Math.round(dy / rowHeight);
    return Math.max(0, Math.min(battingOrder.length - 1, fromIdx + steps));
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragPid) return;
    const dy = e.clientY - startY;
    setTranslate(dy);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragPid) return;
    const dy = e.clientY - startY;
    const target = currentTargetIdx(dy);
    onReorder(fromIdx, target);
    setDragPid(null);
    setTranslate(0);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  const targetIdx = dragPid ? currentTargetIdx(translate) : fromIdx;

  return (
    <div className="flex flex-col gap-2">
      {battingOrder.map((pid, idx) => {
        const player = playerById.get(pid);
        if (!player) return null;
        const isDragging = dragPid === pid;
        let shift = 0;
        if (dragPid && !isDragging) {
          if (targetIdx >= fromIdx && idx > fromIdx && idx <= targetIdx) shift = -rowHeight;
          if (targetIdx < fromIdx && idx < fromIdx && idx >= targetIdx) shift = rowHeight;
        }
        const rowClass =
          player.availability === "UNAVAILABLE"
            ? "order-row-unavail"
            : player.availability === "MAYBE"
              ? "order-row-maybe"
              : "";
        return (
          <div key={pid} className="order-slot">
            <div className="o-slot">{idx + 1}</div>
            <div
              ref={(el) => {
                if (el) rowRefs.current.set(pid, el);
                else rowRefs.current.delete(pid);
              }}
              className={`order-row ${rowClass}${isDragging ? " order-row-dragging" : ""}`}
              style={{
                transform: isDragging
                  ? `translateY(${translate}px)`
                  : shift !== 0
                    ? `translateY(${shift}px)`
                    : undefined,
                transition: isDragging ? "none" : "transform 0.16s ease",
              }}
              onPointerDown={(e) => onPointerDown(e, pid, idx)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="o-name">{player.name}</div>
              {player.availability === "UNAVAILABLE" ? (
                <span className="chip chip--unavailable" style={{ marginRight: 6 }}>
                  out
                </span>
              ) : player.availability === "MAYBE" ? (
                <span className="chip chip--maybe" style={{ marginRight: 6 }}>
                  maybe
                </span>
              ) : null}
              <div className="o-grip" aria-label="Drag to reorder">
                <GripIcon />
              </div>
            </div>
          </div>
        );
      })}
      {unavailablePlayers.length > 0 ? (
        <div
          style={{
            marginTop: "0.35rem",
            paddingTop: "0.6rem",
            borderTop:
              "1px solid color-mix(in srgb, var(--navy) 12%, transparent)",
          }}
        >
          <div
            style={{
              marginBottom: "0.45rem",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--navy) 58%, white)",
            }}
          >
            Not attending
          </div>
          <div className="flex flex-col gap-2">
            {unavailablePlayers.map((player) => (
              <div key={player.id} className="order-slot">
                <div className="o-slot">—</div>
                <div className="order-row order-row-unavail">
                  <div className="o-name">{player.name}</div>
                  <span className="chip chip--unavailable" style={{ marginRight: 6 }}>
                    out
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Matrix({
  battingOrder,
  playerById,
  innings,
  assignments,
  positions,
  selectedInning,
  onSelectInning,
  onSetCell,
  duplicates,
}: {
  battingOrder: string[];
  playerById: Map<string, PlayerSeed>;
  innings: number;
  assignments: Record<string, string[]>;
  positions: Position[];
  selectedInning: number;
  onSelectInning: (i: number) => void;
  onSetCell: (pid: string, inningIdx: number, code: string) => void;
  duplicates: Set<string>[];
}) {
  const [picker, setPicker] = useState<{
    pid: string;
    inningIdx: number;
    top: number;
    left: number;
  } | null>(null);

  return (
    <div className="matrix-wrap" style={{ position: "relative" }}>
      <div className="matrix-scroll">
        <div
          className="matrix"
          style={{ gridTemplateColumns: `110px repeat(${innings}, 56px)` }}
        >
          <div className="mx-cell mx-corner">Order</div>
          {Array.from({ length: innings }, (_, i) => i + 1).map((inn) => (
            <div
              key={`h-${inn}`}
              className={`mx-cell mx-head${inn === selectedInning ? " mx-head-selected" : ""}`}
              onClick={() => onSelectInning(inn)}
            >
              {inn}
            </div>
          ))}
          {battingOrder.map((pid, idx) => {
            const player = playerById.get(pid);
            if (!player) return null;
            const rowClass =
              player.availability === "UNAVAILABLE"
                ? "mx-row-unavail"
                : player.availability === "MAYBE"
                  ? "mx-row-maybe"
                  : "";
            return (
              <MatrixRow
                key={pid}
                pid={pid}
                slotIdx={idx}
                player={player}
                rowClass={rowClass}
                innings={innings}
                assignments={assignments[pid] ?? []}
                selectedInning={selectedInning}
                duplicates={duplicates}
                onOpenPicker={(inIdx, anchor) => {
                  const rect = anchor.getBoundingClientRect();
                  const parent =
                    anchor.closest(".matrix-wrap")?.getBoundingClientRect() ??
                    new DOMRect();
                  setPicker({
                    pid,
                    inningIdx: inIdx,
                    top: rect.bottom - parent.top + 6,
                    left: Math.max(
                      8,
                      Math.min(
                        parent.width - 240,
                        rect.left - parent.left - 60,
                      ),
                    ),
                  });
                }}
              />
            );
          })}
        </div>
      </div>

      {picker ? (
        <div
          className="pos-picker"
          style={{ top: picker.top, left: picker.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pos-picker-grid">
            {positions.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => {
                  onSetCell(picker.pid, picker.inningIdx, p.code);
                  setPicker(null);
                }}
              >
                {p.code}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {picker ? (
        <div
          className="pos-picker-backdrop"
          onClick={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

function MatrixRow({
  pid,
  slotIdx,
  player,
  rowClass,
  innings,
  assignments,
  selectedInning,
  duplicates,
  onOpenPicker,
}: {
  pid: string;
  slotIdx: number;
  player: PlayerSeed;
  rowClass: string;
  innings: number;
  assignments: string[];
  selectedInning: number;
  duplicates: Set<string>[];
  onOpenPicker: (inningIdx: number, anchor: HTMLElement) => void;
}) {
  const firstName = player.name.split(" ")[0];
  return (
    <>
      <div className={`mx-cell mx-player ${rowClass}`}>
        <span className="slot">{slotIdx + 1}</span>
        <span>{firstName}</span>
      </div>
      {Array.from({ length: innings }, (_, inIdx) => {
        const code = assignments[inIdx] ?? "";
        const isDup = duplicates[inIdx]?.has(pid) ?? false;
        const cls = [
          "mx-cell mx-pos",
          rowClass,
          code === "BN" ? "mx-pos-bn" : "",
          inIdx + 1 === selectedInning ? "mx-col-selected" : "",
          isDup ? "mx-pos-duplicate" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={inIdx} className={cls}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPicker(inIdx, e.currentTarget);
              }}
            >
              {code || "—"}
            </button>
          </div>
        );
      })}
    </>
  );
}

function FieldViz({
  battingOrder,
  playerById,
  assignments,
  selectedInning,
}: {
  battingOrder: string[];
  playerById: Map<string, PlayerSeed>;
  assignments: Record<string, string[]>;
  selectedInning: number;
}) {
  const positioned: { code: string; firstName: string }[] = [];
  const bench: string[] = [];
  for (const pid of battingOrder) {
    const code = assignments[pid]?.[selectedInning - 1] ?? "";
    const player = playerById.get(pid);
    if (!player) continue;
    const firstName = player.name.split(" ")[0];
    if (!code || code === "BN") {
      bench.push(firstName);
      continue;
    }
    positioned.push({ code, firstName });
  }

  return (
    <>
      <svg viewBox="0 0 260 180" className="diamond">
        <path className="grass" d="M 130 165 L 40 90 L 130 25 L 220 90 Z" />
        <path className="grass" d="M 20 90 Q 130 -30 240 90" opacity="0.5" />
        <rect className="base" x="125" y="160" width="10" height="10" transform="rotate(45 130 165)" />
        <rect className="base" x="35" y="85" width="10" height="10" transform="rotate(45 40 90)" />
        <rect className="base" x="125" y="20" width="10" height="10" transform="rotate(45 130 25)" />
        <rect className="base" x="215" y="85" width="10" height="10" transform="rotate(45 220 90)" />
        <circle
          cx="130"
          cy="105"
          r="8"
          fill="color-mix(in srgb, var(--orange) 20%, white)"
          stroke="color-mix(in srgb, var(--orange) 50%, white)"
        />
        {positioned.map(({ code, firstName }) => {
          const coord = FIELD_COORDS[code];
          if (!coord) return null;
          return (
            <g key={`${code}-${firstName}`}>
              <circle cx={coord.x} cy={coord.y} r={11} className="pos-dot" />
              <text x={coord.x} y={coord.y + 3} className="pos-code">
                {code}
              </text>
              <text x={coord.x} y={coord.y + 22} className="pos-label">
                {firstName}
              </text>
            </g>
          );
        })}
      </svg>
      {bench.length > 0 ? (
        <div className="bench-row">
          <span className="bench-label">Bench</span>
          {bench.join(" · ")}
        </div>
      ) : null}
    </>
  );
}

function GripIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  );
}
