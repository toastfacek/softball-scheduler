import { notFound, redirect } from "next/navigation";

import { updateEventAction } from "@/actions/event-actions";
import { EventFormFields } from "@/components/event-form-fields";
import { LocationSearch } from "@/components/location-search";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { canManageTeam } from "@/lib/authz";
import { getEventPageData, getViewerContext } from "@/lib/data";

export default async function EditEventPage({
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

  return (
    <>
      <PageHeader title="Edit event" back={`/events/${eventId}`} />
      <form
        action={updateEventAction}
        className="shell-panel rounded-[1.25rem] p-5"
      >
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <LocationSearch
            initial={{
              venueName: data.event.venueName ?? "",
              addressLine1: data.event.addressLine1 ?? "",
              city: data.event.city ?? "",
              state: data.event.state ?? "",
              postalCode: data.event.postalCode ?? "",
            }}
          />
          <EventFormFields event={data.event} />
          <SubmitButton label="Save changes" />
        </div>
      </form>
    </>
  );
}
