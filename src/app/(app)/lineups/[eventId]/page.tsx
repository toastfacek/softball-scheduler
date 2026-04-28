import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { canManageLineups } from "@/lib/authz";
import {
  getLineupEditorData,
  getViewerContext,
  listLineupPresets,
} from "@/lib/data";

import { LineupEditor } from "./lineup-editor";

export default async function LineupEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/sign-in");

  const { eventId } = await params;
  if (!canManageLineups(viewer)) redirect(`/events/${eventId}`);

  const [data, presets] = await Promise.all([
    getLineupEditorData(viewer, eventId),
    listLineupPresets(viewer),
  ]);
  if (!data) notFound();

  // Seed the editor with the persisted batting order for players who are
  // expected to attend; unavailable players remain visible below the order.
  const slots = Array.from(data.battingBySlot.entries()).sort(
    ([a], [b]) => a - b,
  );
  const eligibleIds = new Set(data.eligiblePlayers.map((p) => p.id));
  const eligibleSlots = slots.filter(([, pid]) => eligibleIds.has(pid));
  const persistedIds = new Set(eligibleSlots.map(([, pid]) => pid));
  const initialBattingOrder = [
    ...eligibleSlots.map(([, pid]) => pid),
    ...data.eligiblePlayers
      .filter((p) => !persistedIds.has(p.id))
      .map((p) => p.id),
  ];

  // Seed assignments: use persisted values when present, else fall back to
  // BN / field position default based on batting slot index.
  const fieldCodes = ["P", "C", "1B", "2B", "3B", "SS", "LF", "LCF", "RCF", "RF"];
  const defaultCode = (idx: number) => (idx < fieldCodes.length ? fieldCodes[idx] : "BN");
  const initialAssignments: Record<string, string[]> = {};
  for (const [idx, pid] of initialBattingOrder.entries()) {
    initialAssignments[pid] = Array.from(
      { length: data.inningsCount },
      (_, inning) =>
        data.assignmentMap.get(`${inning + 1}:${pid}`) ?? defaultCode(idx),
    );
  }

  return (
    <>
      <PageHeader title="Lineup" back={`/events/${eventId}`} />
      <LineupEditor
        eventId={eventId}
        eventTitle={data.event.title}
        presets={presets.map((p) => ({ id: p.id, name: p.name }))}
        initialInnings={data.inningsCount}
        initialBattingOrder={initialBattingOrder}
        initialAssignments={initialAssignments}
        players={data.allPlayers.map((p) => ({
          id: p.id,
          name: p.displayName,
          availability: p.eventStatus,
        }))}
        positions={data.positions.map((p) => ({ code: p.code, label: p.label }))}
      />
    </>
  );
}
