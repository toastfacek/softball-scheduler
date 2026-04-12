import { redirect } from "next/navigation";

import { EventStatusChip } from "@/components/status-chip";
import { getLineupsIndexData, getViewerContext } from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";

export default async function LineupsPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  if (!viewer.roles.some((role) => role === "COACH" || role === "ADMIN")) {
    redirect("/schedule");
  }

  const data = await getLineupsIndexData(viewer);

  return (
    <div className="page-grid">
      <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
        <div className="eyebrow">Coach-only workspace</div>
        <h2 className="mt-2 text-3xl text-[var(--navy-strong)]">Game lineup planner</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[color-mix(in_srgb,var(--navy)_74%,white)]">
          Build one batting order for the game, then assign defensive positions
          inning by inning. Unavailable players still stay visible so coaches can
          override intentionally when needed.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {data.games.map((game) => (
          <a
            key={game.id}
            href={`/lineups/${game.id}`}
            className="shell-panel rounded-[2rem] p-5 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Game</div>
                <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">{game.title}</h3>
              </div>
              <EventStatusChip status={game.status} />
            </div>
            <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--navy)_72%,white)]">
              {formatEventDateTimeRange(game.startsAt, game.endsAt)}
            </p>
            <div className="mt-5 inline-flex rounded-full bg-[color-mix(in_srgb,var(--navy)_8%,white)] px-4 py-2 text-sm font-semibold text-[var(--navy-strong)]">
              {game.hasLineup ? "Edit saved lineup" : "Create lineup"}
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}

