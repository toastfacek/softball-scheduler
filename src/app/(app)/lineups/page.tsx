import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getLineupsIndexData, getViewerContext } from "@/lib/data";
import { formatEventDay, formatEventTime } from "@/lib/time";

export default async function LineupsPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  if (!viewer.roles.some((role) => role === "COACH" || role === "ADMIN")) {
    redirect("/schedule");
  }

  const data = await getLineupsIndexData(viewer);

  function split(date: Date) {
    const [dayWord, monthDay] = formatEventDay(date).split(",");
    const parts = (monthDay ?? "").trim().split(" ");
    return { mo: dayWord.trim(), dy: parts[parts.length - 1] ?? "" };
  }

  return (
    <>
      <PageHeader title="Lineups" />
      <div
        className="shell-panel"
        style={{ padding: "0.25rem 0.875rem", borderRadius: "1.25rem" }}
      >
        <div className="row-list">
          {data.games.map((game) => {
            const { mo, dy } = split(game.startsAt);
            return (
              <Link
                key={game.id}
                href={`/lineups/${game.id}`}
                className="row"
              >
                <div className="event-date" style={{ width: 44 }}>
                  <div className="event-date-mo">{mo}</div>
                  <div className="event-date-dy">{dy}</div>
                </div>
                <div className="row-grow">
                  <div className="row-title">{game.title}</div>
                  <div className="row-sub">
                    {formatEventTime(game.startsAt)} · Game
                  </div>
                </div>
                <span
                  className={game.hasLineup ? "btn-secondary" : "btn-primary"}
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.7rem" }}
                >
                  {game.hasLineup ? "Edit" : "Create"}
                </span>
              </Link>
            );
          })}
          {data.games.length === 0 ? (
            <div
              className="row"
              style={{
                cursor: "default",
                color: "color-mix(in srgb, var(--navy) 60%, white)",
                fontSize: "0.85rem",
              }}
            >
              No upcoming games yet.
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
