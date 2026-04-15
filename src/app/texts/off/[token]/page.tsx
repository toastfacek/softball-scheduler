import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { adultUsers } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-tokens";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
};

export default async function TextsOffPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { done } = await searchParams;

  const claims = verifyUnsubscribeToken(token);

  if (!claims) {
    return (
      <div className="rsvp-shell rsvp-shell--centered">
        <div className="rsvp-event-card">
          <h1 className="rsvp-event-title">Link invalid</h1>
          <p className="rsvp-event-meta" style={{ marginTop: "0.5rem" }}>
            This unsubscribe link is no longer valid. Open the app to manage
            your text preferences.
          </p>
        </div>
      </div>
    );
  }

  if (done === "1") {
    return (
      <div className="rsvp-shell rsvp-shell--centered">
        <div className="rsvp-event-card">
          <h1 className="rsvp-event-title">Texts turned off</h1>
          <p className="rsvp-event-meta" style={{ marginTop: "0.5rem" }}>
            You won&apos;t receive any more iMessage nudges from BGSL. We&apos;ll
            keep emailing you reminders if your email is on file.
          </p>
        </div>
      </div>
    );
  }

  async function confirmUnsubscribe() {
    "use server";
    const claims = verifyUnsubscribeToken(token);
    if (!claims) return;
    await db
      .update(adultUsers)
      .set({ textOptIn: false, updatedAt: new Date() })
      .where(eq(adultUsers.id, claims.userId));
    redirect(`/texts/off/${token}?done=1`);
  }

  return (
    <div className="rsvp-shell rsvp-shell--centered">
      <form action={confirmUnsubscribe} className="rsvp-event-card">
        <h1 className="rsvp-event-title">Turn off iMessage nudges?</h1>
        <p className="rsvp-event-meta" style={{ marginTop: "0.5rem" }}>
          You&apos;ll stop receiving iMessages from BGSL. Email reminders will
          continue.
        </p>
        <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Turn off texts
        </button>
      </form>
    </div>
  );
}
