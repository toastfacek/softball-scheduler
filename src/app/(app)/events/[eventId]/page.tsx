import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { EventTypeChip } from "@/components/status-chip";
import { canManageTeam } from "@/lib/authz";
import { getEventPageData, getViewerContext } from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";
import { formatAddress } from "@/lib/utils";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const viewer = await getViewerContext();
  const { eventId } = await params;

  if (!viewer) {
    redirect("/sign-in");
  }

  const data = await getEventPageData(viewer, eventId);
  if (!data) notFound();

  const canManage = canManageTeam(viewer);
  const address = formatAddress([
    data.event.venueName,
    data.event.addressLine1,
    data.event.addressLine2,
    data.event.city,
    data.event.state,
    data.event.postalCode,
  ]);
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  const isGame = data.event.type === "GAME";

  return (
    <>
      <PageHeader
        title={data.event.title}
        back="/schedule"
        action={
          canManage ? (
            <Link
              href={`/events/${data.event.id}/edit`}
              className="icon-btn"
              aria-label="Edit event"
            >
              <PencilIcon />
            </Link>
          ) : null
        }
      />

      <div className="page-split">
      <section className="shell-panel rounded-tile p-4">
        <div className="orange-bar-top" />
        <div className="relative flex flex-wrap items-center gap-2 mb-2">
          <EventTypeChip type={data.event.type} />
          <span className="chip chip--scheduled">
            {data.event.status.toLowerCase()}
          </span>
        </div>
        <h2
          className="relative"
          style={{
            fontSize: "1.5rem",
            color: "var(--navy-strong)",
            fontFamily: "var(--font-barlow-condensed), sans-serif",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {data.event.title}
        </h2>
        <div
          className="relative mt-2 flex flex-col gap-1.5"
          style={{
            fontSize: "0.8rem",
            color: "color-mix(in srgb, var(--navy) 74%, white)",
            fontWeight: 500,
          }}
        >
          <div className="flex items-center gap-2">
            <ClockIcon />
            <span>
              {formatEventDateTimeRange(data.event.startsAt, data.event.endsAt)}
            </span>
          </div>
          {address ? (
            <a
              href={mapsHref ?? "#"}
              target="_blank"
              rel="noreferrer noopener"
              className="location-link"
              style={{ alignSelf: "flex-start" }}
            >
              <PinIcon />
              <span>{address}</span>
              <ExtIcon />
            </a>
          ) : null}
        </div>
        {data.event.description ? (
          <p
            className="relative mt-2"
            style={{
              fontSize: "0.85rem",
              color: "color-mix(in srgb, var(--navy) 72%, white)",
            }}
          >
            {data.event.description}
          </p>
        ) : null}
      </section>

      {canManage ? (
        <div className="flex flex-col gap-2">
          <Link
            href={`/events/${data.event.id}/attendance`}
            className="action-row"
          >
            <div className="action-icon">
              <UsersIcon />
            </div>
            <div className="row-grow">
              <div className="row-title">Attendance</div>
              <div className="row-sub">
                {data.playerSummary.AVAILABLE} in ·{" "}
                {data.playerSummary.MAYBE} maybe ·{" "}
                {data.playerSummary.UNAVAILABLE} out ·{" "}
                {data.playerSummary.pending} waiting
              </div>
            </div>
            <ChevronRightIcon />
          </Link>

          {isGame ? (
            <Link
              href={`/lineups/${data.event.id}`}
              className="action-row"
            >
              <div className="action-icon">
                <GridIcon />
              </div>
              <div className="row-grow">
                <div className="row-title">Lineup</div>
                <div className="row-sub">Batting order and positions</div>
              </div>
              <ChevronRightIcon />
            </Link>
          ) : null}

          <Link
            href={`/events/${data.event.id}/email`}
            className="action-row"
          >
            <div className="action-icon">
              <MailIcon />
            </div>
            <div className="row-grow">
              <div className="row-title">Email families</div>
              <div className="row-sub">Send an update to guardians</div>
            </div>
            <ChevronRightIcon />
          </Link>
        </div>
      ) : null}
      </div>
    </>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function ExtIcon() {
  return (
    <svg className="ext" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11l-3 3-2-2" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg className="row-chevron" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
