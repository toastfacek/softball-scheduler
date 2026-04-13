import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { canManageTeam } from "@/lib/authz";
import { getSchedulePageData, getViewerContext } from "@/lib/data";
import { formatEventDay, formatEventTime } from "@/lib/time";

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

  return (
    <>
      <PageHeader
        title="Schedule"
        action={
          canManageTeam(viewer) && data.events.length > 0 ? (
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

      <div className="page-split page-split--narrow-right">
      <div className="schedule-main-col">
        <ScheduleCalendar
          events={data.events.map((e) => ({
            id: e.id,
            title: e.title,
            type: e.type,
            startsAt: e.startsAt,
          }))}
          canAddEvents={canManageTeam(viewer)}
        />
      </div>

      <aside className="schedule-aside">
        {data.events.length > 0 ? (
          <div
            className="shell-panel"
            style={{ padding: "0.25rem 0.875rem", borderRadius: "1.25rem" }}
          >
            <div className="section-head">Events</div>
            <div className="row-list">
              {data.events.map((event) => {
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
        ) : (
          <div className="shell-panel schedule-empty">
            <div className="schedule-empty-eyebrow">Season warming up</div>
            <h2 className="schedule-empty-title">
              {canManageTeam(viewer)
                ? "The season is waiting."
                : "Your coach hasn't scheduled anything yet."}
            </h2>
            <p className="schedule-empty-sub">
              {canManageTeam(viewer)
                ? "Add a practice or a game and every guardian gets an RSVP email."
                : "You'll get an email the moment something's on the books."}
            </p>
            {canManageTeam(viewer) ? (
              <Link href="/schedule/new" className="btn-primary schedule-empty-cta">
                Schedule first event
              </Link>
            ) : null}
          </div>
        )}
      </aside>
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

