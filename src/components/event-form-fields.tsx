import { dateToLocalInput } from "@/lib/time";
import type { EventStatus, EventType } from "@/db/schema";

type EventSeed = {
  id?: string;
  title?: string | null;
  description?: string | null;
  type?: EventType;
  status?: EventStatus;
  startsAt?: Date | null;
};

export function EventFormFields({ event }: { event?: EventSeed }) {
  return (
    <div className="event-form-grid grid gap-4 sm:grid-cols-2">
      {event?.id ? <input type="hidden" name="eventId" value={event.id} /> : null}

      <div className="space-y-2 sm:col-span-2">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          defaultValue={event?.title ?? ""}
          placeholder="Saturday double-header"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="type">Type</label>
        <select id="type" name="type" defaultValue={event?.type ?? "PRACTICE"}>
          <option value="PRACTICE">Practice</option>
          <option value="GAME">Game</option>
          <option value="TEAM_EVENT">Team event</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={event?.status ?? "SCHEDULED"}>
          <option value="SCHEDULED">Scheduled</option>
          <option value="CANCELED">Canceled</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label htmlFor="startsAt">Date &amp; time</label>
        <input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          className="event-form-datetime"
          defaultValue={event?.startsAt ? dateToLocalInput(event.startsAt) : ""}
          required
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label htmlFor="description">Notes</label>
        <textarea
          id="description"
          name="description"
          defaultValue={event?.description ?? ""}
          placeholder="Bring black socks, arrive 20 minutes early, or note weather plans."
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="notifyCalendar"
            value="on"
            className="mt-1"
          />
          <span>
            <span className="font-medium">Push update to parents&apos; calendars</span>
            <span className="block text-sm opacity-75">
              Emails everyone an iCal attachment so the event appears (or
              updates) in Gmail / Outlook / Apple Calendar within minutes.
            </span>
          </span>
        </label>
        <textarea
          name="notifyCalendarNote"
          placeholder="Optional one-line note to include in the email body (e.g. why you're sending this update)."
          rows={2}
        />
      </div>
    </div>
  );
}
