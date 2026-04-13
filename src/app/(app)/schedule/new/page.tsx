import { redirect } from "next/navigation";

import { createEventAction } from "@/actions/event-actions";
import { EventFormFields } from "@/components/event-form-fields";
import { LocationSearch } from "@/components/location-search";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { canManageTeam } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";
import { localInputToDate } from "@/lib/time";

type SearchParams = Promise<{ date?: string }>;

// Default start time for a prefilled date: 5:30pm in the team's timezone
// (typical practice slot). We deliberately route through localInputToDate
// instead of `new Date(y, m, d, 17, 30)` so the prefill doesn't drift on a
// UTC server — there, `new Date(...)` would construct 17:30 UTC (13:30 ET)
// instead of 17:30 ET.
function parseDateParam(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = localInputToDate(`${raw}T17:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const viewer = await getViewerContext();
  if (!viewer) return null;
  if (!canManageTeam(viewer)) redirect("/schedule");

  const { date } = await searchParams;
  const prefilledStart = parseDateParam(date);

  return (
    <>
      <PageHeader title="New event" back="/schedule" />
      <form
        action={createEventAction}
        className="shell-panel rounded-tile p-5"
      >
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <LocationSearch />
          <EventFormFields
            event={prefilledStart ? { startsAt: prefilledStart } : undefined}
          />
          <SubmitButton label="Create event" />
        </div>
      </form>
    </>
  );
}
