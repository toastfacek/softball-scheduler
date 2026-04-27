import Link from "next/link";

import { signOutAction } from "@/actions/auth-actions";
import { PageHeader } from "@/components/page-header";
import { canManageTeam } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";

export default async function SettingsPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  const canManage = canManageTeam(viewer);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="linked-list">
        <Link href="/settings/profile" className="row">
          <div className="row-grow">
            <div className="row-title">Profile</div>
            <div className="row-sub">Name, phone, reminders</div>
          </div>
          <ChevronRightIcon />
        </Link>
        <Link href="/settings/calendar" className="row">
          <div className="row-grow">
            <div className="row-title">Subscribe to calendar</div>
            <div className="row-sub">
              Subscribe in Outlook, Google, or Apple Calendar
            </div>
          </div>
          <ChevronRightIcon />
        </Link>
        {canManage ? (
          <>
            <Link href="/settings/team" className="row">
              <div className="row-grow">
                <div className="row-title">Team</div>
                <div className="row-sub">Name and subtitle</div>
              </div>
              <ChevronRightIcon />
            </Link>
            <Link href="/settings/broadcast" className="row">
              <div className="row-grow">
                <div className="row-title">Team broadcast</div>
                <div className="row-sub">Send an email to the whole team</div>
              </div>
              <ChevronRightIcon />
            </Link>
          </>
        ) : null}
        <form action={signOutAction} className="row danger">
          <div className="row-grow">
            <button
              type="submit"
              className="row-title"
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "inherit",
                font: "inherit",
                textAlign: "left",
                width: "100%",
              }}
            >
              Sign out
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="row-chevron"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
