import { redirect } from "next/navigation";

import { createEventAction } from "@/actions/event-actions";
import { EventFormFields } from "@/components/event-form-fields";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { canManageTeam } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";

export default async function NewEventPage() {
  const viewer = await getViewerContext();
  if (!viewer) return null;
  if (!canManageTeam(viewer)) redirect("/schedule");

  return (
    <>
      <PageHeader title="New event" back="/schedule" />
      <form
        action={createEventAction}
        className="shell-panel rounded-[1.25rem] p-5"
      >
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <EventFormFields />
          <SubmitButton label="Create event" />
        </div>
      </form>
    </>
  );
}
