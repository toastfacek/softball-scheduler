import { redirect } from "next/navigation";

import { updateTeamAction } from "@/actions/settings-actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { canManageTeam } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";

export default async function TeamSettingsPage() {
  const viewer = await getViewerContext();
  if (!viewer) return null;
  if (!canManageTeam(viewer)) redirect("/settings");

  return (
    <>
      <PageHeader title="Team" back="/settings" />
      <form
        action={updateTeamAction}
        className="shell-panel rounded-[1.25rem] p-5"
      >
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name">Team name</label>
            <input
              id="name"
              name="name"
              defaultValue={viewer.team.name}
              required
              maxLength={80}
            />
            <p
              style={{
                fontSize: "0.72rem",
                color: "color-mix(in srgb, var(--navy) 60%, white)",
              }}
            >
              Shows up on the sidebar, in emails, and on the RSVP page.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="brandSubtitle">Subtitle (optional)</label>
            <input
              id="brandSubtitle"
              name="brandSubtitle"
              defaultValue={viewer.team.brandSubtitle ?? ""}
              placeholder="Middle School Juniors — Spring 2026"
              maxLength={120}
            />
            <p
              style={{
                fontSize: "0.72rem",
                color: "color-mix(in srgb, var(--navy) 60%, white)",
              }}
            >
              Small secondary line under the team name. Leave blank to hide.
            </p>
          </div>
          <SubmitButton label="Save" />
        </div>
      </form>
    </>
  );
}
