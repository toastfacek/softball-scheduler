import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { canManageTeam } from "@/lib/authz";
import { getEventPageData, getViewerContext } from "@/lib/data";
import { formatEventDay, formatEventTime } from "@/lib/time";

const STATUS_ORDER: Record<
  "AVAILABLE" | "MAYBE" | "UNAVAILABLE" | "WAITING",
  number
> = {
  AVAILABLE: 0,
  MAYBE: 1,
  UNAVAILABLE: 2,
  WAITING: 3,
};

type StatusKey = "AVAILABLE" | "MAYBE" | "UNAVAILABLE" | "WAITING";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/sign-in");
  const { eventId } = await params;
  if (!canManageTeam(viewer)) redirect(`/events/${eventId}`);

  const data = await getEventPageData(viewer, eventId);
  if (!data) notFound();

  type Row = {
    key: string;
    name: string;
    status: StatusKey;
    note: string | null;
    role: string | null;
    source: "APP" | "EMAIL_LINK" | "COACH_MANUAL" | null;
  };

  const playerRows: Row[] = data.playerCards.map((p) => ({
    key: `p-${p.id}`,
    name: p.name,
    status: (p.response?.status ?? "WAITING") as StatusKey,
    note: p.response?.note ?? null,
    role: null,
    source: p.response?.responseSource ?? null,
  }));

  const staffRows: Row[] = data.staff.map((s) => ({
    key: `s-${s.userId}`,
    name: s.name,
    status: (s.response?.status ?? "WAITING") as StatusKey,
    note: s.response?.note ?? null,
    role: s.roles[0]?.toLowerCase() ?? null,
    source: null,
  }));

  const rows = [...playerRows, ...staffRows].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <PageHeader title="Attendance" back={`/events/${eventId}`} />

      <section className="shell-panel rounded-tile p-4">
        <div className="orange-bar-top" />
        <div className="relative flex items-center gap-2 mb-1">
          <span
            className={`chip ${
              data.event.type === "GAME" ? "chip--game" : "chip--practice"
            }`}
          >
            {data.event.type}
          </span>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "var(--navy-strong)",
              fontFamily: "var(--font-barlow-condensed), sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {data.event.title}
          </span>
        </div>
        <div
          className="relative flex flex-wrap gap-x-3"
          style={{
            fontSize: "0.72rem",
            color: "color-mix(in srgb, var(--navy) 70%, white)",
            fontWeight: 500,
          }}
        >
          <span>
            {formatEventDay(data.event.startsAt)} ·{" "}
            {formatEventTime(data.event.startsAt)}
          </span>
          {data.event.venueName ? <span>{data.event.venueName}</span> : null}
        </div>
      </section>

      <section className="shell-panel rounded-tile p-4">
        <div className="grid grid-cols-4 gap-2">
          <StatTile count={data.playerSummary.AVAILABLE} label="In" variant="avail" />
          <StatTile count={data.playerSummary.MAYBE} label="Maybe" variant="maybe" />
          <StatTile count={data.playerSummary.UNAVAILABLE} label="Out" variant="out" />
          <StatTile count={data.playerSummary.pending} label="Wait" variant="wait" />
        </div>
      </section>

      <section
        className="shell-panel"
        style={{ padding: "0.25rem 0.875rem", borderRadius: "1.25rem" }}
      >
        <div className="row-list">
          {rows.map((row) => (
            <div key={row.key} className="row" style={{ cursor: "default" }}>
              <div className="row-grow">
                <div className="row-title">{row.name}</div>
                {row.note || row.source ? (
                  <div className="row-sub flex items-center gap-1.5">
                    {row.source ? <SourceTag source={row.source} /> : null}
                    {row.note ? <span>{row.note}</span> : null}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                {row.role ? (
                  <span className="chip chip--role">{row.role}</span>
                ) : null}
                <StatusChip status={row.status} />
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div
              className="row"
              style={{
                cursor: "default",
                color: "color-mix(in srgb, var(--navy) 60%, white)",
                fontSize: "0.85rem",
              }}
            >
              No roster yet.
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function StatTile({
  count,
  label,
  variant,
}: {
  count: number;
  label: string;
  variant: "avail" | "maybe" | "out" | "wait";
}) {
  const palette = {
    avail: {
      border: "color-mix(in srgb, var(--success) 26%, white)",
      bg: "color-mix(in srgb, var(--success) 10%, white)",
      color: "color-mix(in srgb, var(--success) 78%, black)",
    },
    maybe: {
      border: "color-mix(in srgb, var(--warning) 26%, white)",
      bg: "color-mix(in srgb, var(--warning) 18%, white)",
      color: "color-mix(in srgb, var(--warning) 80%, black)",
    },
    out: {
      border: "color-mix(in srgb, var(--danger) 22%, white)",
      bg: "color-mix(in srgb, var(--danger) 10%, white)",
      color: "color-mix(in srgb, var(--danger) 82%, black)",
    },
    wait: {
      border: "color-mix(in srgb, var(--navy) 12%, white)",
      bg: "color-mix(in srgb, var(--navy) 8%, white)",
      color: "var(--navy-strong)",
    },
  }[variant];
  return (
    <div
      style={{
        borderRadius: "0.75rem",
        padding: "0.5rem 0.4rem",
        textAlign: "center",
        border: `1px solid ${palette.border}`,
        background: palette.bg,
      }}
    >
      <div
        style={{
          fontSize: "1.1rem",
          fontWeight: 900,
          fontFamily: "var(--font-barlow-condensed), sans-serif",
          lineHeight: 1,
          color: palette.color,
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontSize: "0.55rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginTop: "2px",
          color: palette.color,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SourceTag({
  source,
}: {
  source: "APP" | "EMAIL_LINK" | "COACH_MANUAL";
}) {
  const label =
    source === "EMAIL_LINK"
      ? "email"
      : source === "COACH_MANUAL"
        ? "coach logged"
        : "app";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.05rem 0.35rem",
        borderRadius: "0.3rem",
        fontSize: "0.55rem",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "color-mix(in srgb, var(--navy) 62%, white)",
        background: "color-mix(in srgb, var(--navy) 6%, white)",
        border: "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
      }}
    >
      {label}
    </span>
  );
}

function StatusChip({ status }: { status: StatusKey }) {
  const map: Record<StatusKey, { cls: string; label: string }> = {
    AVAILABLE: { cls: "chip--available", label: "available" },
    MAYBE: { cls: "chip--maybe", label: "maybe" },
    UNAVAILABLE: { cls: "chip--unavailable", label: "out" },
    WAITING: { cls: "chip--waiting", label: "waiting" },
  };
  const entry = map[status];
  return <span className={`chip ${entry.cls}`}>{entry.label}</span>;
}
