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
      <form action={updateProfileAction} className="shell-panel rounded-[1.25rem] p-5">
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
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium">
            <input
              type="checkbox"
              name="reminderOptIn"
              defaultChecked={viewer.adult.reminderOptIn}
              className="h-4 w-4"
            />
            Email me 24-hour reminder nudges if my player hasn&apos;t responded
          </label>
          <SubmitButton label="Save" />
        </div>
      </form>
    </>
  );
}
