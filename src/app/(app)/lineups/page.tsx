import Link from "next/link";
import { redirect } from "next/navigation";

import { deleteLineupPresetAction } from "@/actions/lineup-actions";
import { PageHeader } from "@/components/page-header";
import {
  getLineupsIndexData,
  getViewerContext,
  listLineupPresets,
} from "@/lib/data";
import { formatEventDay, formatEventTime } from "@/lib/time";

export default async function LineupsPage() {
  const viewer = await getViewerContext();
  if (!viewer) return null;
  if (!viewer.roles.some((role) => role === "COACH" || role === "ADMIN")) {
    redirect("/schedule");
  }

  const [data, presets] = await Promise.all([
    getLineupsIndexData(viewer),
    listLineupPresets(viewer),
  ]);

  function split(date: Date) {
    const [dayWord, monthDay] = formatEventDay(date).split(",");
    const parts = (monthDay ?? "").trim().split(" ");
    return { mo: dayWord.trim(), dy: parts[parts.length - 1] ?? "" };
  }

  return (
    <>
      <PageHeader title="Lineups" />

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <section>
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
              Presets
            </h2>
            <Link
              href="/lineups/presets/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.35rem 0.7rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                background: "var(--orange-strong)",
                color: "white",
                borderRadius: "0.45rem",
                textDecoration: "none",
              }}
            >
              + New preset
            </Link>
          </div>

          {presets.length === 0 ? (
            <div
              style={{
                padding: "0.75rem 0.875rem",
                fontSize: "0.85rem",
                color: "color-mix(in srgb, var(--navy) 60%, white)",
              }}
            >
              No presets yet. Build one and reuse it across games.
            </div>
          ) : (
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
              {presets.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.875rem",
                    padding: "0.7rem 1rem",
                    borderBottom:
                      i === presets.length - 1
                        ? "none"
                        : "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
                  }}
                >
                  <Link
                    href={`/lineups/presets/${p.id}`}
                    style={{
                      flex: "1 1 auto",
                      textDecoration: "none",
                      color: "var(--navy-strong)",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "color-mix(in srgb, var(--navy) 55%, white)",
                        marginTop: "0.1rem",
                      }}
                    >
                      {p.inningsCount} innings
                    </div>
                  </Link>
                  <Link
                    href={`/lineups/presets/${p.id}`}
                    style={{
                      padding: "0.3rem 0.65rem",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--navy-strong)",
                      border:
                        "1px solid color-mix(in srgb, var(--navy) 20%, white)",
                      borderRadius: "0.4rem",
                      textDecoration: "none",
                    }}
                  >
                    Edit
                  </Link>
                  <form action={deleteLineupPresetAction}>
                    <input type="hidden" name="presetId" value={p.id} />
                    <button
                      type="submit"
                      style={{
                        padding: "0.3rem 0.65rem",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "var(--danger)",
                        background: "transparent",
                        border:
                          "1px solid color-mix(in srgb, var(--danger) 30%, white)",
                        borderRadius: "0.4rem",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
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
              Games
            </h2>
          </div>
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
        </section>
      </div>
    </>
  );
}
