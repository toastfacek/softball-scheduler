import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Mail, MapPinned, Navigation } from "lucide-react";

import {
  markAdultActualAttendanceAction,
  markPlayerActualAttendanceAction,
  sendEventUpdateAction,
  updateAdultAvailabilityAction,
  updateEventAction,
  updatePlayerAvailabilityAction,
} from "@/actions/event-actions";
import { EventFormFields } from "@/components/event-form-fields";
import {
  EventStatusChip,
  EventTypeChip,
  ResponseChip,
} from "@/components/status-chip";
import { SubmitButton } from "@/components/submit-button";
import {
  canManagePrivateContacts,
  canManageTeam,
} from "@/lib/authz";
import { getEventPageData, getViewerContext } from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";
import { appleMapsHref, formatAddress, googleMapsHref } from "@/lib/utils";

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

  if (!data) {
    notFound();
  }

  const address = formatAddress([
    data.event.venueName,
    data.event.addressLine1,
    data.event.addressLine2,
    data.event.city,
    data.event.state,
    data.event.postalCode,
  ]);

  return (
    <div className="page-grid">
      <section className="shell-panel overflow-hidden rounded-[2.25rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeChip type={data.event.type} />
          <EventStatusChip status={data.event.status} />
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <h2 className="text-4xl text-[var(--navy-strong)]">{data.event.title}</h2>
            <p className="text-base leading-7 text-[color-mix(in_srgb,var(--navy)_74%,white)]">
              {formatEventDateTimeRange(data.event.startsAt, data.event.endsAt)}
            </p>
            {data.event.description ? (
              <p className="max-w-3xl text-base leading-7 text-[color-mix(in_srgb,var(--navy)_74%,white)]">
                {data.event.description}
              </p>
            ) : null}
          </div>

          <div className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-5">
            <div className="eyebrow">Location</div>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3">
                <MapPinned className="mt-0.5 h-5 w-5 text-[var(--harbor)]" />
                <div>
                  <div className="font-semibold text-[var(--navy-strong)]">
                    {data.event.venueName || "Venue TBD"}
                  </div>
                  <div className="text-sm text-[color-mix(in_srgb,var(--navy)_72%,white)]">
                    {address || "Add a venue and address for directions."}
                  </div>
                </div>
              </div>
              {address ? (
                <div className="flex flex-wrap gap-3">
                  <a
                    href={googleMapsHref(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navy-strong)]"
                  >
                    <Navigation className="h-4 w-4" />
                    Google Maps
                  </a>
                  <a
                    href={appleMapsHref(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navy-strong)]"
                  >
                    <Navigation className="h-4 w-4" />
                    Apple Maps
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {data.viewerPlayers.length > 0 ? (
        <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="mb-5">
            <div className="eyebrow">Family responses</div>
            <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">
              Update your player availability
            </h3>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {data.viewerPlayers.map((player) => (
              <form
                key={player.id}
                action={updatePlayerAvailabilityAction}
                className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-5"
              >
                <input type="hidden" name="eventId" value={data.event.id} />
                <input type="hidden" name="playerId" value={player.id} />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-[var(--navy-strong)]">
                      {player.name}
                    </div>
                    <div className="text-sm text-[color-mix(in_srgb,var(--navy)_68%,white)]">
                      Let coaches know if anything changes.
                    </div>
                  </div>
                  <ResponseChip status={player.response?.status ?? null} />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-[0.65fr_1fr]">
                  <div className="space-y-2">
                    <label htmlFor={`status-${player.id}`}>Status</label>
                    <select
                      id={`status-${player.id}`}
                      name="status"
                      defaultValue={player.response?.status ?? "AVAILABLE"}
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="MAYBE">Maybe</option>
                      <option value="UNAVAILABLE">Unavailable</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={`note-${player.id}`}>Optional note</label>
                    <textarea
                      id={`note-${player.id}`}
                      name="note"
                      defaultValue={player.response?.note ?? ""}
                      placeholder="Running 10 minutes late, leaving early, or anything else coaches should know."
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <SubmitButton label="Save response" />
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      {viewer.roles.includes("COACH") || viewer.roles.includes("ADMIN") ? (
        <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="mb-5">
            <div className="eyebrow">Coach attendance</div>
            <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">
              Update your coach availability
            </h3>
          </div>
          <form action={updateAdultAvailabilityAction} className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
            <input type="hidden" name="eventId" value={data.event.id} />
            <div className="space-y-2">
              <label htmlFor="coach-status">Status</label>
              <select
                id="coach-status"
                name="status"
                defaultValue={data.viewerAdultResponse?.status ?? "AVAILABLE"}
              >
                <option value="AVAILABLE">Available</option>
                <option value="MAYBE">Maybe</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="coach-note">Note</label>
              <textarea
                id="coach-note"
                name="note"
                defaultValue={data.viewerAdultResponse?.note ?? ""}
                placeholder="Need to leave after warmups, arriving separately, or other coach logistics."
              />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton label="Save coach response" />
            </div>
          </form>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="eyebrow">Players</div>
              <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">
                Attendance board
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="stat-pill">{data.playerSummary.AVAILABLE} available</span>
              <span className="stat-pill">{data.playerSummary.MAYBE} maybe</span>
              <span className="stat-pill">{data.playerSummary.UNAVAILABLE} out</span>
              <span className="stat-pill">{data.playerSummary.pending} waiting</span>
            </div>
          </div>

          <div className="space-y-3">
            {data.playerCards.map((player) => (
              <div
                key={player.id}
                className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-[var(--navy-strong)]">
                      {player.name}
                    </div>
                    {player.response?.note ? (
                      <div className="mt-1 text-sm text-[color-mix(in_srgb,var(--navy)_70%,white)]">
                        {player.response.note}
                      </div>
                    ) : null}
                  </div>
                  <ResponseChip status={player.response?.status ?? null} />
                </div>

                {canManageTeam(viewer) ? (
                  <form
                    action={markPlayerActualAttendanceAction}
                    className="mt-4 flex flex-wrap items-center gap-3"
                  >
                    <input type="hidden" name="eventId" value={data.event.id} />
                    <input type="hidden" name="playerId" value={player.id} />
                    <select
                      name="actualAttendance"
                      defaultValue={player.response?.actualAttendance ?? "UNKNOWN"}
                      className="max-w-[220px]"
                    >
                      <option value="UNKNOWN">Actual attendance unknown</option>
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                    </select>
                    <SubmitButton label="Record check-in" />
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="page-grid">
          <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
            <div className="mb-5">
              <div className="eyebrow">Coaches and admins</div>
              <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">Staff board</h3>
            </div>
            <div className="space-y-3">
              {data.staff.map((staffer) => (
                <div
                  key={staffer.userId}
                  className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-[var(--navy-strong)]">
                        {staffer.name}
                      </div>
                      <div className="text-sm text-[color-mix(in_srgb,var(--navy)_68%,white)]">
                        {staffer.roles.join(" · ").toLowerCase()}
                      </div>
                      {canManagePrivateContacts(viewer) ? (
                        <div className="mt-2 space-y-1 text-sm text-[color-mix(in_srgb,var(--navy)_70%,white)]">
                          <div>{staffer.email}</div>
                          {staffer.phone ? <div>{staffer.phone}</div> : null}
                        </div>
                      ) : null}
                    </div>
                    <ResponseChip status={staffer.response?.status ?? null} />
                  </div>

                  {canManageTeam(viewer) ? (
                    <form
                      action={markAdultActualAttendanceAction}
                      className="mt-4 flex flex-wrap items-center gap-3"
                    >
                      <input type="hidden" name="eventId" value={data.event.id} />
                      <input type="hidden" name="userId" value={staffer.userId} />
                      <select
                        name="actualAttendance"
                        defaultValue={staffer.response?.actualAttendance ?? "UNKNOWN"}
                        className="max-w-[220px]"
                      >
                        <option value="UNKNOWN">Actual attendance unknown</option>
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                      </select>
                      <SubmitButton label="Record check-in" />
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {canManageTeam(viewer) ? (
            <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <Mail className="h-5 w-5 text-[var(--orange-strong)]" />
                <div>
                  <div className="eyebrow">Practice and game updates</div>
                  <h3 className="mt-1 text-xl text-[var(--navy-strong)]">
                    Send an event email
                  </h3>
                </div>
              </div>
              <form action={sendEventUpdateAction} className="space-y-4">
                <input type="hidden" name="eventId" value={data.event.id} />
                <div className="space-y-2">
                  <label htmlFor="audience">Recipients</label>
                  <select id="audience" name="audience" defaultValue="ALL_GUARDIANS">
                    <option value="ALL_GUARDIANS">All guardians on the team</option>
                    <option value="RESPONDED_PLAYERS">
                      Guardians of players who already responded
                    </option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="subject">Subject</label>
                  <input
                    id="subject"
                    name="subject"
                    defaultValue={`${data.event.title} update`}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="body">Message</label>
                  <textarea
                    id="body"
                    name="body"
                    placeholder="Share weather updates, field changes, arrival notes, or anything else the team needs."
                  />
                </div>
                <SubmitButton label="Send update email" />
              </form>
            </section>
          ) : null}
        </div>
      </section>

      {canManageTeam(viewer) ? (
        <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="mb-5">
            <div className="eyebrow">Event admin</div>
            <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">Edit event details</h3>
          </div>
          <form action={updateEventAction} className="space-y-5">
            <EventFormFields event={data.event} />
            <div className="flex flex-wrap gap-3">
              <SubmitButton label="Save event changes" />
              {data.event.type === "GAME" ? (
                <Link
                  href={`/lineups/${data.event.id}`}
                  className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy-strong)]"
                >
                  Open lineup planner
                </Link>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

