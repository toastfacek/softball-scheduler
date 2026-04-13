import { notFound, redirect } from "next/navigation";

import { LineupEditor } from "@/app/(app)/lineups/[eventId]/lineup-editor";
import { PageHeader } from "@/components/page-header";
import { canManageLineups } from "@/lib/authz";
import { getLineupPresetEditorData, getViewerContext } from "@/lib/data";

export default async function EditPresetPage({
  params,
}: {
  params: Promise<{ presetId: string }>;
}) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/sign-in");
  if (!canManageLineups(viewer)) redirect("/lineups");

  const { presetId } = await params;
  const data = await getLineupPresetEditorData(viewer, presetId);
  if (!data) notFound();

  const slots = Array.from(data.battingBySlot.entries()).sort(
    ([a], [b]) => a - b,
  );
  const persistedIds = new Set(slots.map(([, pid]) => pid));
  const initialBattingOrder = [
    ...slots.map(([, pid]) => pid),
    ...data.allPlayers.filter((p) => !persistedIds.has(p.id)).map((p) => p.id),
  ];

  const fieldCodes = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  const defaultCode = (idx: number) => (idx < fieldCodes.length ? fieldCodes[idx] : "BN");
  const initialAssignments: Record<string, string[]> = {};
  for (const [idx, pid] of initialBattingOrder.entries()) {
    initialAssignments[pid] = Array.from(
      { length: data.preset.inningsCount },
      (_, inning) =>
        data.assignmentMap.get(`${inning + 1}:${pid}`) ?? defaultCode(idx),
    );
  }

  return (
    <>
      <PageHeader title="Edit preset" back="/lineups" />
      <LineupEditor
        presetId={presetId}
        initialPresetName={data.preset.name}
        eventTitle={data.preset.name}
        initialInnings={data.preset.inningsCount}
        initialBattingOrder={initialBattingOrder}
        initialAssignments={initialAssignments}
        players={data.allPlayers.map((p) => ({
          id: p.id,
          name: p.displayName,
          availability: null,
        }))}
        positions={data.positions.map((p) => ({ code: p.code, label: p.label }))}
      />
    </>
  );
}
