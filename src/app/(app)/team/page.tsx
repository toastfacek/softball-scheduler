import { PageHeader } from "@/components/page-header";
import { ContactActions } from "@/components/contact-actions";
import { canManagePrivateContacts, canManageTeam } from "@/lib/authz";
import { getTeamPageData, getViewerContext } from "@/lib/data";
import type { TeamRole } from "@/db/schema";

import { RosterSection } from "./roster-section";

export default async function TeamPage() {
  const viewer = await getViewerContext();
  if (!viewer) return null;

  const data = await getTeamPageData(viewer);
  const showContacts = canManagePrivateContacts(viewer);

  const staff = data.staff
    .filter(
      (person) =>
        person.roles.includes("COACH") || person.roles.includes("ADMIN"),
    )
    .sort((left, right) => {
      const priority = getStaffPriority(left) - getStaffPriority(right);
      if (priority !== 0) {
        return priority;
      }

      return staffSortLabel(left).localeCompare(staffSortLabel(right));
    });

  const roster = [...data.players].sort((a, b) => {
    const ja = a.jerseyNumber ?? Number.POSITIVE_INFINITY;
    const jb = b.jerseyNumber ?? Number.POSITIVE_INFINITY;
    if (ja !== jb) return ja - jb;
    return a.lastName.localeCompare(b.lastName);
  });

  return (
    <>
      <PageHeader title="Team" />

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        <TeamOverview
          teamName={viewer.team.name}
          brandSubtitle={viewer.team.brandSubtitle}
          seasonName={viewer.seasonName}
          staffCount={staff.length}
          rosterCount={roster.length}
        />
        <StaffSection
          title="Staff"
          staff={staff}
          showContacts={showContacts}
        />
        <RosterSection
          roster={roster}
          showContacts={showContacts}
          canEdit={canManageTeam(viewer)}
        />
      </div>
    </>
  );
}

function TeamOverview({
  teamName,
  brandSubtitle,
  seasonName,
  staffCount,
  rosterCount,
}: {
  teamName: string;
  brandSubtitle: string | null;
  seasonName: string | null;
  staffCount: number;
  rosterCount: number;
}) {
  return (
    <section
      className="shell-panel relative overflow-hidden rounded-[1.5rem] p-5 sm:p-6"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <div className="orange-bar-top" />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        <div
          style={{
            fontFamily: "var(--font-barlow-condensed), sans-serif",
            fontWeight: 700,
            fontSize: "2.25rem",
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            color: "var(--navy-strong)",
            textTransform: "uppercase",
          }}
        >
          {teamName}
        </div>
        {brandSubtitle ? (
          <div
            style={{
              fontSize: "0.86rem",
              lineHeight: 1.5,
              color: "color-mix(in srgb, var(--navy) 68%, white)",
              fontWeight: 600,
            }}
          >
            {brandSubtitle}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <TeamOverviewStat label="Season" value={seasonName ?? "Current"} />
        <TeamOverviewStat label="Staff" value={String(staffCount)} />
        <TeamOverviewStat label="Roster" value={String(rosterCount)} />
      </div>
    </section>
  );
}

function TeamOverviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        borderRadius: "1rem",
        padding: "0.85rem 0.95rem",
        background: "color-mix(in srgb, var(--paper) 88%, white)",
        border: "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.68rem",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--navy) 54%, white)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: label === "Season" ? "0.95rem" : "1.15rem",
          color: "var(--navy-strong)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

type Staffer = {
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  roles: TeamRole[];
  titles: string[];
};

function staffSortLabel(staffer: Staffer) {
  return (staffer.name ?? staffer.email).trim().toLowerCase();
}

function isHeadCoach(staffer: Staffer) {
  return staffer.titles.some((title) => title.toLowerCase() === "head coach");
}

function getStaffPriority(staffer: Staffer) {
  if (isHeadCoach(staffer)) return 0;
  if (staffer.roles.includes("COACH")) return 1;
  if (staffer.roles.includes("ADMIN")) return 2;
  return 3;
}

function getStaffBadges(staffer: Staffer) {
  const badges: Array<{ label: string; variant: "lead" | "role" }> = [];
  const explicitTitles = staffer.titles
    .map((title) => title.trim())
    .filter(Boolean);

  for (const title of explicitTitles) {
    badges.push({
      label: title,
      variant: title.toLowerCase() === "head coach" ? "lead" : "role",
    });
  }

  if (staffer.roles.includes("COACH") && explicitTitles.length === 0) {
    badges.push({ label: "Coach", variant: "role" });
  }

  if (staffer.roles.includes("ADMIN")) {
    badges.push({ label: "Admin", variant: "role" });
  }

  return Array.from(
    new Map(
      badges.map((badge) => [badge.label.toLowerCase(), badge]),
    ).values(),
  );
}

function StaffSection({
  title,
  staff,
  showContacts,
}: {
  title: string;
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
        {staff.map((s) => {
          const badges = getStaffBadges(s);

          return (
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
                gap: "0.35rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0.45rem",
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
                {badges.map((badge) => (
                  <span
                    key={badge.label}
                    className={`chip ${
                      badge.variant === "lead" ? "chip--staff-lead" : "chip--role"
                    }`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
              {showContacts ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    fontSize: "0.78rem",
                    color: "color-mix(in srgb, var(--navy) 64%, white)",
                  }}
                >
                  <span>{s.email}</span>
                  <ContactActions
                    phone={s.phone}
                    name={s.name ?? s.email.split("@")[0]}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
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
