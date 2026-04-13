import { redirect } from "next/navigation";

import { sendBroadcastAction } from "@/actions/settings-actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { canManageTeam } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";

export default async function BroadcastPage() {
  const viewer = await getViewerContext();

  if (!viewer) return null;
  if (!canManageTeam(viewer)) redirect("/settings");

  return (
    <>
      <PageHeader title="Team broadcast" back="/settings" />
      <form action={sendBroadcastAction} className="shell-panel rounded-tile p-5">
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scope">Audience</label>
            <select id="scope" name="scope" defaultValue="ALL">
              <option value="ALL">Entire team</option>
              <option value="GUARDIANS">Guardians only</option>
              <option value="STAFF">Coaches and admins only</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              name="subject"
              placeholder="Season schedule update"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="body">Message</label>
            <textarea
              id="body"
              name="body"
              placeholder="Practice location changes, weather, arrival time…"
              required
            />
          </div>
          <SubmitButton label="Send" />
        </div>
      </form>
    </>
  );
}
