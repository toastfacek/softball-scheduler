import { PageHeader } from "@/components/page-header";
import { canManageTeam } from "@/lib/authz";
import { getTeamPageData, getViewerContext } from "@/lib/data";

import { TeamAddSheet } from "./team-add-sheet";

export default async function TeamPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  const data = await getTeamPageData(viewer);

  return (
    <>
      <PageHeader
        title={viewer.team.name}
        action={
          canManageTeam(viewer) ? (
            <TeamAddSheet
              players={data.players.map((p) => ({
                id: p.id,
                displayName: p.displayName,
              }))}
            />
          ) : null
        }
      />

      <div className="page-split">
      <div
        className="shell-panel"
        style={{ padding: "0.25rem 0.875rem", borderRadius: "1.25rem" }}
      >
        <div className="section-head">Roster</div>
        <div className="row-list">
          {data.players.map((player) => {
            const jersey =
              player.jerseyNumber != null ? String(player.jerseyNumber) : "—";
            const guardianCount = player.guardians.length;
            const sub =
              guardianCount === 0
                ? "invited · no guardian yet"
                : `${guardianCount} guardian${guardianCount === 1 ? "" : "s"}`;
            return (
              <div key={player.id} className="row">
                <span className="row-jersey">{jersey}</span>
                <div className="row-grow">
                  <div className="row-title">{player.displayName}</div>
                  <div className="row-sub">{sub}</div>
                </div>
              </div>
            );
          })}
          {data.players.length === 0 ? (
            <div
              className="row"
              style={{
                cursor: "default",
                color: "color-mix(in srgb, var(--navy) 60%, white)",
                fontSize: "0.85rem",
              }}
            >
              No players yet. Tap + to add one.
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="shell-panel"
        style={{ padding: "0.25rem 0.875rem", borderRadius: "1.25rem" }}
      >
        <div className="section-head">Staff</div>
        <div className="row-list">
          {data.staff.map((staffer) => (
            <div key={staffer.userId} className="row" style={{ cursor: "default" }}>
              <div className="row-grow">
                <div className="row-title">{staffer.name || staffer.email}</div>
                <div className="row-sub">{staffer.roleLabel}</div>
              </div>
              <span
                className={`chip chip--role`}
                style={{ textTransform: "uppercase" }}
              >
                {staffer.roleLabel}
              </span>
            </div>
          ))}
          {data.staff.length === 0 ? (
            <div
              className="row"
              style={{
                cursor: "default",
                color: "color-mix(in srgb, var(--navy) 60%, white)",
                fontSize: "0.85rem",
              }}
            >
              No coaches or admins yet.
            </div>
          ) : null}
        </div>
      </div>
      </div>
    </>
  );
}
