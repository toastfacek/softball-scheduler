import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { saveLineupAction } from "@/actions/lineup-actions";
import { SubmitButton } from "@/components/submit-button";
import { EventStatusChip, ResponseChip } from "@/components/status-chip";
import { getLineupEditorData, getViewerContext } from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";

export default async function LineupEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  if (!viewer.roles.some((role) => role === "COACH" || role === "ADMIN")) {
    redirect("/schedule");
  }

  const { eventId } = await params;
  const data = await getLineupEditorData(viewer, eventId);

  if (!data) {
    notFound();
  }

  return (
    <div className="page-grid">
      <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="eyebrow">Inning-by-inning lineup</div>
          <EventStatusChip status={data.event.status} />
        </div>
        <h2 className="mt-3 text-3xl text-[var(--navy-strong)]">{data.event.title}</h2>
        <p className="mt-3 text-base leading-7 text-[color-mix(in_srgb,var(--navy)_74%,white)]">
          {formatEventDateTimeRange(data.event.startsAt, data.event.endsAt)}
        </p>
      </section>

      {data.unavailablePlayers.length > 0 ? (
        <section className="shell-panel rounded-[2rem] border border-[color-mix(in_srgb,var(--warning)_28%,white)] bg-[color-mix(in_srgb,var(--warning)_10%,white)] p-6">
          <div className="eyebrow text-[color-mix(in_srgb,var(--warning)_82%,black)]">
            Override with care
          </div>
          <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">
            Players marked unavailable
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.unavailablePlayers.map((player) => (
              <div
                key={player.id}
                className="rounded-full border border-[color-mix(in_srgb,var(--warning)_28%,white)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--navy-strong)]"
              >
                {player.displayName}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <form action={saveLineupAction} className="page-grid">
        <input type="hidden" name="eventId" value={data.event.id} />
        <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="eyebrow">Batting order</div>
              <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">One order for the full game</h3>
            </div>
            <div className="w-full max-w-[220px] space-y-2">
              <label htmlFor="inningsCount">Planned innings</label>
              <input
                id="inningsCount"
                name="inningsCount"
                type="number"
                min="1"
                max="9"
                defaultValue={data.inningsCount}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: data.allPlayers.length }).map((_, index) => {
              const slotNumber = index + 1;
              return (
                <div
                  key={slotNumber}
                  className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4"
                >
                  <label htmlFor={`slot-${slotNumber}`}>Slot {slotNumber}</label>
                  <select
                    id={`slot-${slotNumber}`}
                    name={`slot:${slotNumber}`}
                    defaultValue={data.battingBySlot.get(slotNumber) ?? ""}
                    className="mt-2"
                    required
                  >
                    <option value="">Choose player</option>
                    {data.allPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.displayName}
                        {player.eventStatus ? ` · ${player.eventStatus.toLowerCase()}` : " · waiting"}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>

        <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="mb-5">
            <div className="eyebrow">Defensive assignments</div>
            <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">
              Set each player’s position for every inning
            </h3>
          </div>

          <div className="space-y-5">
            {Array.from({ length: 9 }).map((_, inningIndex) => {
              const inningNumber = inningIndex + 1;
              const optional = inningNumber > data.inningsCount;
              return (
                <section
                  key={inningNumber}
                  className="rounded-[1.75rem] border border-[var(--line)] bg-white/75 p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="eyebrow">
                        Inning {inningNumber}
                        {optional ? " · optional extra inning" : ""}
                      </div>
                      <h4 className="mt-1 text-xl text-[var(--navy-strong)]">
                        Defensive map
                      </h4>
                    </div>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {data.allPlayers.map((player) => (
                      <div
                        key={`${inningNumber}-${player.id}`}
                        className="rounded-[1.25rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_86%,white)] p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="font-semibold text-[var(--navy-strong)]">
                            {player.displayName}
                          </div>
                          <ResponseChip status={player.eventStatus} />
                        </div>
                        <select
                          name={`inning:${inningNumber}:${player.id}`}
                          defaultValue={
                            data.assignmentMap.get(`${inningNumber}:${player.id}`) ??
                            "BENCH"
                          }
                          required
                        >
                          {data.positions.map((position) => (
                            <option key={position.id} value={position.code}>
                              {position.code} · {position.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <SubmitButton label="Save lineup" />
          <Link
            href={`/events/${data.event.id}`}
            className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy-strong)]"
          >
            Back to event
          </Link>
        </div>
      </form>
    </div>
  );
}
