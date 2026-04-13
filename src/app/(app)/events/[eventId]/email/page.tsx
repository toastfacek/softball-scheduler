import { notFound, redirect } from "next/navigation";

import { sendEventUpdateAction } from "@/actions/event-actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { canManageTeam } from "@/lib/authz";
import { getEventPageData, getViewerContext } from "@/lib/data";

export default async function EventEmailPage({
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
      <PageHeader title="Email families" back={`/events/${eventId}`} />
      <form
        action={sendEventUpdateAction}
        className="shell-panel rounded-tile p-5"
      >
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <input type="hidden" name="eventId" value={data.event.id} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="audience">Recipients</label>
            <select id="audience" name="audience" defaultValue="ALL_GUARDIANS">
              <option value="ALL_GUARDIANS">All guardians</option>
              <option value="RESPONDED_PLAYERS">
                Guardians of players who responded
              </option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              name="subject"
              defaultValue={`${data.event.title} update`}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="body">Message</label>
            <textarea
              id="body"
              name="body"
              placeholder="Weather updates, field changes, arrival notes…"
              required
            />
          </div>
          <SubmitButton label="Send" />
        </div>
      </form>
    </>
  );
}
