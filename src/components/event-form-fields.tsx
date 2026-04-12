import { dateToLocalInput } from "@/lib/time";
import type { EventStatus, EventType } from "@/db/schema";

type EventSeed = {
  id?: string;
  title?: string | null;
  description?: string | null;
  type?: EventType;
  status?: EventStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  venueName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};

export function EventFormFields({ event }: { event?: EventSeed }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="space-y-2">
        <label htmlFor="startsAt">Starts at</label>
        <input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          defaultValue={event?.startsAt ? dateToLocalInput(event.startsAt) : ""}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="endsAt">Ends at</label>
        <input
          id="endsAt"
          name="endsAt"
          type="datetime-local"
          defaultValue={event?.endsAt ? dateToLocalInput(event.endsAt) : ""}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label htmlFor="venueName">Venue</label>
        <input
          id="venueName"
          name="venueName"
          defaultValue={event?.venueName ?? ""}
          placeholder="Beverly Common"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label htmlFor="addressLine1">Address line 1</label>
        <input
          id="addressLine1"
          name="addressLine1"
          defaultValue={event?.addressLine1 ?? ""}
          placeholder="123 Main Street"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label htmlFor="addressLine2">Address line 2</label>
        <input
          id="addressLine2"
          name="addressLine2"
          defaultValue={event?.addressLine2 ?? ""}
          placeholder="Field 3"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="city">City</label>
        <input id="city" name="city" defaultValue={event?.city ?? "Beverly"} />
      </div>

      <div className="space-y-2">
        <label htmlFor="state">State</label>
        <input id="state" name="state" defaultValue={event?.state ?? "MA"} />
      </div>

      <div className="space-y-2">
        <label htmlFor="postalCode">Postal code</label>
        <input id="postalCode" name="postalCode" defaultValue={event?.postalCode ?? ""} />
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
    </div>
  );
}

