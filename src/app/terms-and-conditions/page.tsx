import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — BGSL",
};

export default function TermsAndConditionsPage() {
  return (
    <main className="rsvp-shell" style={{ maxWidth: "40rem" }}>
      <article className="rsvp-event-card" style={{ textAlign: "left" }}>
        <h1
          className="rsvp-event-title"
          style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}
        >
          Terms &amp; Conditions
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "2rem" }}>
          Last updated: April 17, 2026
        </p>

        <Section title="Acceptance of terms">
          <p>
            By using the Beverly Girls Softball League (&quot;BGSL&quot;) app,
            you agree to these terms. If you do not agree, do not use the
            service.
          </p>
        </Section>

        <Section title="Description of service">
          <p>
            BGSL is a private, invitation-only team management app for
            coordinating youth softball activities including scheduling,
            attendance tracking, lineup planning, and team communications. Access
            is granted by a coach or team admin.
          </p>
        </Section>

        <Section title="SMS terms">
          <p>
            By opting in to text message notifications in your profile settings,
            you consent to receive automated text messages from BGSL at the
            phone number you provide. These messages include game and practice
            reminders, schedule changes, and attendance requests.
          </p>
          <ul>
            <li>
              <strong>Message frequency:</strong> Varies. Typically a few
              messages per week during the season.
            </li>
            <li>
              <strong>Message and data rates may apply.</strong> Contact your
              wireless carrier for details.
            </li>
            <li>
              <strong>Opt out:</strong> Reply <strong>STOP</strong> to any
              message to unsubscribe. You can also use the &quot;Stop
              texts&quot; link in each message or toggle the preference off in
              your profile settings.
            </li>
            <li>
              <strong>Help:</strong> Reply <strong>HELP</strong> for assistance
              or email{" "}
              <a
                href="mailto:jelee85@gmail.com"
                style={{ color: "var(--orange)" }}
              >
                jelee85@gmail.com
              </a>
              .
            </li>
          </ul>
          <p>
            SMS is provided via Twilio. Carriers are not liable for delayed or
            undelivered messages.
          </p>
        </Section>

        <Section title="User conduct">
          <p>
            You agree to use BGSL only for its intended purpose — managing your
            team&apos;s softball activities. You will not use the service to send
            spam, harass other users, or share content unrelated to team
            coordination.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            Your use of BGSL is also governed by our{" "}
            <a href="/privacy-policy" style={{ color: "var(--orange)" }}>
              Privacy Policy
            </a>
            , which describes what data we collect and how we use it.
          </p>
        </Section>

        <Section title="Availability">
          <p>
            BGSL is provided &quot;as is.&quot; We make no guarantees about
            uptime or availability. We may modify or discontinue the service at
            any time.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            BGSL is a free, volunteer-run tool for team coordination. To the
            fullest extent permitted by law, we are not liable for any damages
            arising from your use of the service, including missed
            notifications, scheduling errors, or service interruptions.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms from time to time. Continued use of BGSL
            after changes constitutes acceptance of the updated terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions? Email{" "}
            <a href="mailto:jelee85@gmail.com" style={{ color: "var(--orange)" }}>
              jelee85@gmail.com
            </a>
            .
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2
        style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: "0.875rem",
          lineHeight: 1.6,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {children}
      </div>
    </section>
  );
}
