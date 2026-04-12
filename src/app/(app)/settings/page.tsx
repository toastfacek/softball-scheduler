import { signOutAction } from "@/actions/auth-actions";
import {
  sendBroadcastAction,
  updateProfileAction,
} from "@/actions/settings-actions";
import { SubmitButton } from "@/components/submit-button";
import { canManageTeam } from "@/lib/authz";
import { getSettingsPageData, getViewerContext } from "@/lib/data";

export default async function SettingsPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  const data = await getSettingsPageData(viewer);

  return (
    <div className="page-grid">
      <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
        <div className="eyebrow">Your profile</div>
        <h2 className="mt-2 text-3xl text-[var(--navy-strong)]">Settings</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[color-mix(in_srgb,var(--navy)_74%,white)]">
          Keep your contact details current, choose whether reminders should
          reach you automatically, and send team-wide updates if you manage the
          team.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form action={updateProfileAction} className="shell-panel rounded-[2rem] p-6">
          <div className="mb-4">
            <div className="eyebrow">Personal details</div>
            <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">Account profile</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" defaultValue={viewer.adult.name ?? ""} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="email">Email</label>
              <input id="email" value={viewer.adult.email} disabled />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" defaultValue={viewer.adult.phone ?? ""} />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium">
              <input
                type="checkbox"
                name="reminderOptIn"
                defaultChecked={viewer.adult.reminderOptIn}
                className="h-4 w-4"
              />
              Email me automatic 24-hour reminder nudges if my player has not responded
            </label>
            <div className="stat-pill text-sm font-semibold text-[var(--navy-strong)]">
              Roles: {data.roles.join(" · ").toLowerCase()}
            </div>
            <SubmitButton label="Save profile" />
          </div>
        </form>

        <div className="page-grid">
          {canManageTeam(viewer) ? (
            <form action={sendBroadcastAction} className="shell-panel rounded-[2rem] p-6">
              <div className="mb-4">
                <div className="eyebrow">Manual broadcast</div>
                <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">Send a team email</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="scope">Audience</label>
                  <select id="scope" name="scope" defaultValue="ALL">
                    <option value="ALL">Entire team</option>
                    <option value="GUARDIANS">Guardians only</option>
                    <option value="STAFF">Coaches and admins only</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="subject">Subject</label>
                  <input id="subject" name="subject" placeholder="Tomorrow’s practice plan" required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="body">Message</label>
                  <textarea
                    id="body"
                    name="body"
                    placeholder="Send a quick note about practice location changes, weather, arrival time, or anything else the group should know."
                    required
                  />
                </div>
                <SubmitButton label="Send email" />
              </div>
            </form>
          ) : null}

          <section className="shell-panel rounded-[2rem] p-6">
            <div className="mb-4">
              <div className="eyebrow">Account</div>
              <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">Sign out</h3>
            </div>
            <p className="mb-5 text-sm leading-6 text-[color-mix(in_srgb,var(--navy)_74%,white)]">
              Magic-link sign in means there is no password to manage. Signing
              out just clears this device session.
            </p>
            <form action={signOutAction}>
              <SubmitButton label="Sign out" className="bg-[var(--orange-strong)] hover:bg-[var(--orange)]" />
            </form>
          </section>
        </div>
      </section>
    </div>
  );
}

