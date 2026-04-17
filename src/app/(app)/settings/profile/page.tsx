import { updateProfileAction } from "@/actions/settings-actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getViewerContext } from "@/lib/data";

export default async function ProfilePage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  return (
    <>
      <PageHeader title="Profile" back="/settings" />
      <form action={updateProfileAction} className="shell-panel rounded-tile p-5">
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              defaultValue={viewer.adult.name ?? ""}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email">Email</label>
            <input id="email" value={viewer.adult.email} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={viewer.adult.phone ?? ""}
              placeholder="(555) 555-5555"
            />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium">
            <input
              type="checkbox"
              name="reminderOptIn"
              defaultChecked={viewer.adult.reminderOptIn}
              className="h-4 w-4"
            />
            Send 24-hour reminder nudges if my player hasn&apos;t responded
          </label>
          <div className="rounded-2xl border border-line bg-white px-4 py-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                name="textOptIn"
                defaultChecked={viewer.adult.textOptIn}
                className="h-4 w-4"
              />
              Prefer text messages over email when my phone is on file
            </label>
            <p
              className="text-xs"
              style={{
                marginTop: "0.5rem",
                paddingLeft: "1.75rem",
                color: "color-mix(in srgb, var(--navy) 55%, white)",
                lineHeight: 1.5,
              }}
            >
              By opting in you agree to receive automated texts from BGSL
              (reminders, schedule updates). Msg frequency varies, typically a
              few/week during the season. Msg &amp; data rates may apply. Reply
              STOP to cancel anytime.{" "}
              <a href="/privacy-policy" style={{ color: "var(--orange)" }}>
                Privacy Policy
              </a>
              {" · "}
              <a href="/terms-and-conditions" style={{ color: "var(--orange)" }}>
                Terms
              </a>
            </p>
          </div>
          <SubmitButton label="Save" />
        </div>
      </form>
    </>
  );
}
