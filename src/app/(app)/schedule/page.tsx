import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { canManageTeam } from "@/lib/authz";
import { getSchedulePageData, getViewerContext } from "@/lib/data";
import {
  formatEventDateTimeRange,
  formatEventDay,
  formatEventTime,
} from "@/lib/time";

type StatusBit =
  | { kind: "dot"; className: string; label: string }
  | null;

function summaryDot(
  viewerResponse: "AVAILABLE" | "UNAVAILABLE" | "MAYBE" | null,
): StatusBit {
  if (viewerResponse === "AVAILABLE")
    return { kind: "dot", className: "dot--avail", label: "available" };
  if (viewerResponse === "MAYBE")
    return { kind: "dot", className: "dot--maybe", label: "maybe" };
  if (viewerResponse === "UNAVAILABLE")
    return { kind: "dot", className: "dot--out", label: "out" };
  return { kind: "dot", className: "dot--wait", label: "waiting" };
}

function splitEventDay(date: Date) {
  const [dayWord, monthDay] = formatEventDay(date).split(",");
  const parts = (monthDay ?? "").trim().split(" ");
  return { mo: dayWord.trim(), dy: parts[parts.length - 1] ?? "" };
}

export default async function SchedulePage() {
  const viewer = await getViewerContext();
  if (!viewer) return null;

  const data = await getSchedulePageData(viewer);
  const upcoming = data.events.filter((e) => e.id !== data.nextEvent?.id);

  return (
    <>
      <PageHeader
        title="Schedule"
        action={
          canManageTeam(viewer) ? (
            <Link
              href="/schedule/new"
              className="icon-btn icon-btn--primary"
              aria-label="Add event"
            >
              <PlusIcon />
            </Link>
          ) : null
        }
      />

      <div className="page-split">
      {data.nextEvent ? (
        <Link href={`/events/${data.nextEvent.id}`} className="next-event">
          <div
            style={{
              fontSize: "0.58rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "color-mix(in srgb, var(--orange) 86%, white)",
            }}
          >
            Next up
          </div>
          <h2
            style={{
              fontSize: "1.75rem",
              color: "white",
              marginTop: "0.25rem",
            }}
          >
            {data.nextEvent.title}
          </h2>
          <div className="next-event-meta">
            <ClockIcon />
            <span>
              {formatEventDateTimeRange(
                data.nextEvent.startsAt,
                data.nextEvent.endsAt,
              )}
            </span>
          </div>
          {data.nextEvent.venueName ? (
            <div className="next-event-meta">
              <PinIcon />
              <span>
                {data.nextEvent.venueName}
                {data.nextEvent.city ? `, ${data.nextEvent.city}` : ""}
              </span>
            </div>
          ) : null}
          {data.nextEvent.viewerPlayers.length > 0 ? (
            <div
              style={{
                marginTop: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                borderRadius: "0.6rem",
                border:
                  "1px solid color-mix(in srgb, var(--success) 36%, transparent)",
                background:
                  "color-mix(in srgb, var(--success) 18%, transparent)",
                padding: "0.25rem 0.5rem",
                fontSize: "0.6rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "color-mix(in srgb, var(--success) 88%, white)",
              }}
            >
              {data.nextEvent.viewerPlayers[0].name.split(" ")[0]} ·{" "}
              {(
                data.nextEvent.viewerPlayers[0].response ?? "waiting"
              ).toLowerCase()}
            </div>
          ) : null}
        </Link>
      ) : (
        <div
          className="shell-panel"
          style={{
            padding: "1.25rem",
            borderRadius: "1.25rem",
            textAlign: "center",
            color: "color-mix(in srgb, var(--navy) 68%, white)",
          }}
        >
          No events yet.{" "}
          {canManageTeam(viewer)
            ? "Tap + to add one."
            : "Your coach hasn't scheduled any yet."}
        </div>
      )}

      {upcoming.length > 0 ? (
        <div
          className="shell-panel page-split-stretch"
          style={{ padding: "0.25rem 0.875rem", borderRadius: "1.25rem" }}
        >
          <div className="section-head">Upcoming</div>
          <div className="row-list">
            {upcoming.map((event) => {
              const { mo, dy } = splitEventDay(event.startsAt);
              const statusBit = summaryDot(
                event.viewerPlayers[0]?.response ?? null,
              );
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="event-row"
                >
                  <div className="event-date">
                    <div className="event-date-mo">{mo}</div>
                    <div className="event-date-dy">{dy}</div>
                  </div>
                  <div className="row-grow">
                    <div className="row-title">{event.title}</div>
                    <div className="row-sub">
                      {formatEventTime(event.startsAt)} ·{" "}
                      {event.type === "GAME" ? "Game" : "Practice"}
                    </div>
                  </div>
                  {statusBit ? (
                    <span
                      className={`dot ${statusBit.className}`}
                      aria-label={statusBit.label}
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
