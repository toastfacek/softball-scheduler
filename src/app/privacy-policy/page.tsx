import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — BGSL",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="rsvp-shell" style={{ maxWidth: "40rem" }}>
      <article className="rsvp-event-card" style={{ textAlign: "left" }}>
        <h1
          className="rsvp-event-title"
          style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}
        >
          Privacy Policy
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "2rem" }}>
          Last updated: April 17, 2026
        </p>

        <Section title="What we collect">
          <p>
            Beverly Girls Softball League (&quot;BGSL,&quot; &quot;we&quot;)
            collects the following information when a coach or admin adds you to
            a team:
          </p>
          <ul>
            <li>Name and email address</li>
            <li>Phone number (optional, for text message notifications)</li>
            <li>Player names and roster associations</li>
            <li>RSVP responses and attendance records</li>
          </ul>
        </Section>

        <Section title="How we use it">
          <ul>
            <li>Send game and practice reminders via email or text message</li>
            <li>Track attendance and RSVP status for team events</li>
            <li>Allow coaches to plan lineups</li>
          </ul>
          <p>
            We do not sell, rent, or share your personal information for
            marketing purposes.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>We use the following services to operate BGSL:</p>
          <ul>
            <li>
              <strong>Twilio</strong> — delivers text messages to opted-in phone
              numbers
            </li>
            <li>
              <strong>Resend</strong> — delivers email notifications and magic
              link sign-ins
            </li>
            <li>
              <strong>Vercel</strong> — hosts the web application
            </li>
            <li>
              <strong>Railway</strong> — hosts the database and scheduled
              reminders
            </li>
          </ul>
          <p>
            These services process your data only to deliver their respective
            functions. We do not share your data with any other third parties.
          </p>
        </Section>

        <Section title="Text messages">
          <p>
            If you opt in to text messages in your profile settings, we will send
            you game and practice reminders, schedule updates, and attendance
            requests via SMS to the phone number on file. Message frequency
            varies but is typically a few messages per week during the season.
            Message and data rates may apply.
          </p>
          <p>
            <strong>
              We will never sell, share, or rent your mobile phone number to
              third parties for promotional or marketing purposes.
            </strong>{" "}
            Your phone number is used solely to deliver BGSL team notifications
            that you have opted in to receive. Your opt-in consent and SMS
            consent data will not be shared with any third party. Third-party
            service providers (Twilio) process your number only to transmit
            messages on our behalf and are contractually prohibited from using
            it for any other purpose.
          </p>
          <p>
            You can opt out at any time by replying <strong>STOP</strong> to any
            message, using the &quot;Stop texts&quot; link in each message, or
            toggling the preference off in your profile settings. Reply{" "}
            <strong>HELP</strong> for assistance or contact us at the email
            below.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We retain your information for as long as your team account is
            active. Coaches and admins can remove your account at any time, which
            deletes your personal information from our systems.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You may request access to, correction of, or deletion of your
            personal information at any time by contacting us.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email{" "}
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
