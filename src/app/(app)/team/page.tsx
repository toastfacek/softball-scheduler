import { PageHeader } from "@/components/page-header";
import { canManagePrivateContacts, canManageTeam } from "@/lib/authz";
import { getTeamPageData, getViewerContext } from "@/lib/data";
import type { TeamRole } from "@/db/schema";

import { TeamAddSheet } from "./team-add-sheet";

export default async function TeamPage() {
  const viewer = await getViewerContext();
  if (!viewer) return null;

  const data = await getTeamPageData(viewer);
  const showContacts = canManagePrivateContacts(viewer);
  const canManage = canManageTeam(viewer);

  const admins = data.staff.filter((s) => s.roles.includes("ADMIN"));
  const coaches = data.staff.filter(
    (s) => s.roles.includes("COACH") && !s.roles.includes("ADMIN"),
  );

  const roster = [...data.players].sort((a, b) => {
    const ja = a.jerseyNumber ?? Number.POSITIVE_INFINITY;
    const jb = b.jerseyNumber ?? Number.POSITIVE_INFINITY;
    if (ja !== jb) return ja - jb;
    return a.lastName.localeCompare(b.lastName);
  });

  return (
    <>
      <PageHeader
        title={viewer.team.name}
        action={
          canManage ? (
            <TeamAddSheet
              players={data.players.map((p) => ({
                id: p.id,
                displayName: p.displayName,
              }))}
            />
          ) : null
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        <StaffSection
          title="Admins"
          roles={["ADMIN"]}
          staff={admins}
          showContacts={showContacts}
        />
        <StaffSection
          title="Coaches"
          roles={["COACH"]}
          staff={coaches}
          showContacts={showContacts}
        />
        <RosterSection
          roster={roster}
          showContacts={showContacts}
        />
      </div>
    </>
  );
}

type Staffer = {
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  roles: TeamRole[];
};

function StaffSection({
  title,
  staff,
  showContacts,
}: {
  title: string;
  roles: TeamRole[];
  staff: Staffer[];
  showContacts: boolean;
}) {
  if (staff.length === 0) return null;

  return (
    <section>
      <SectionHead label={title} count={staff.length} />
      <div
        style={{
          display: "grid",
          gap: "0.625rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        }}
      >
        {staff.map((s) => (
          <div
            key={s.userId}
            style={{
              background: "var(--paper)",
              border:
                "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
              borderRadius: "0.9rem",
              padding: "0.75rem 0.875rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--navy-strong)",
                letterSpacing: "-0.005em",
              }}
            >
              {s.name ?? s.email.split("@")[0]}
            </div>
            {showContacts ? (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "color-mix(in srgb, var(--navy) 64%, white)",
                }}
              >
                {s.email}
                {s.phone ? ` · ${s.phone}` : ""}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

type Player = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
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

function RosterSection({
  roster,
  showContacts,
}: {
  roster: Player[];
  showContacts: boolean;
}) {
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
              gridTemplateColumns: "52px minmax(0, 1fr) minmax(0, 1.4fr)",
              alignItems: "center",
              gap: "1rem",
              padding: "0.75rem 1rem",
              borderBottom:
                i === roster.length - 1
                  ? "none"
                  : "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
            }}
          >
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
              {player.jerseyNumber ?? "—"}
            </div>
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
                  <span key={g.userId}>
                    <span style={{ fontWeight: 600 }}>
                      {g.name ?? g.email.split("@")[0]}
                    </span>
                    {showContacts && g.phone ? (
                      <span
                        style={{
                          marginLeft: "0.3rem",
                          color:
                            "color-mix(in srgb, var(--navy) 50%, white)",
                          fontVariantNumeric: "tabular-nums",
                          fontSize: "0.78rem",
                        }}
                      >
                        {g.phone}
                      </span>
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
          </div>
        ))}
      </div>
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
