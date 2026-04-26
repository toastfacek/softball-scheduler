import { eq } from "drizzle-orm";

import {
  ensureCalendarSyncTokenAction,
  rotateCalendarSyncTokenAction,
} from "@/actions/calendar-actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { adultUsers } from "@/db/schema";
import { getViewerContext } from "@/lib/data";
import { env } from "@/lib/env";

import { CopyableUrl } from "./copyable-url";

export default async function CalendarSyncPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  const adult = await db.query.adultUsers.findFirst({
    where: eq(adultUsers.id, viewer.userId),
    columns: { calendarSyncToken: true },
  });

  const token = adult?.calendarSyncToken ?? null;
  const httpsUrl = token
    ? `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/calendar/${token}/events.ics`
    : null;
  const webcalUrl = httpsUrl
    ? httpsUrl.replace(/^https?:/, "webcal:")
    : null;

  return (
    <>
      <PageHeader title="Calendar sync" back="/settings" />
      <div className="shell-panel rounded-tile p-5">
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <p className="text-sm" style={{ lineHeight: 1.5 }}>
            Subscribe to your team&apos;s schedule in Outlook, Google Calendar,
            or Apple Calendar. Events update automatically whenever the team
            schedule changes.
          </p>

          {httpsUrl && webcalUrl ? (
            <>
              <CopyableUrl httpsUrl={httpsUrl} webcalUrl={webcalUrl} />
              <details
                className="rounded-2xl border border-line bg-white px-4 py-3 text-sm"
                style={{ lineHeight: 1.5 }}
              >
                <summary
                  className="font-semibold"
                  style={{ cursor: "pointer" }}
                >
                  How to subscribe
                </summary>
                <div className="flex flex-col gap-3" style={{ marginTop: 12 }}>
                  <div>
                    <div className="font-semibold">Google Calendar</div>
                    <div>
                      Settings → Add calendar → From URL → paste the URL above
                      → Add calendar.
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">Outlook (web / 365)</div>
                    <div>
                      Calendar → Add calendar → Subscribe from web → paste the
                      URL → Import.
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">Apple Calendar (Mac)</div>
                    <div>
                      File → New Calendar Subscription → paste the URL →
                      Subscribe.
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">Apple Calendar (iOS)</div>
                    <div>
                      Settings → Calendar → Accounts → Add Account → Other →
                      Add Subscribed Calendar → paste the URL.
                    </div>
                  </div>
                </div>
              </details>
              <form action={rotateCalendarSyncTokenAction}>
                <SubmitButton
                  label="Reset link"
                  pendingLabel="Resetting..."
                />
                <p
                  className="text-xs"
                  style={{
                    marginTop: 8,
                    color: "color-mix(in srgb, var(--navy) 55%, white)",
                    lineHeight: 1.5,
                  }}
                >
                  Generates a new URL and breaks any existing calendar
                  subscriptions on your devices. Use this if you shared the URL
                  by accident.
                </p>
              </form>
            </>
          ) : (
            <form action={ensureCalendarSyncTokenAction}>
              <SubmitButton
                label="Show my subscription URL"
                pendingLabel="Generating..."
              />
              <p
                className="text-xs"
                style={{
                  marginTop: 8,
                  color: "color-mix(in srgb, var(--navy) 55%, white)",
                  lineHeight: 1.5,
                }}
              >
                Generates a private URL only you should have. Anyone with the
                URL can read your team&apos;s schedule.
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
