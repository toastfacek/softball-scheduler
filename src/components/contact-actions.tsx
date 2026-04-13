function sanitizePhoneForUri(phone: string) {
  const plus = phone.trimStart().startsWith("+") ? "+" : "";
  return plus + phone.replace(/\D/g, "");
}

export function ContactActions({
  phone,
  name,
}: {
  phone: string | null;
  name: string;
}) {
  if (!phone) return null;
  const target = sanitizePhoneForUri(phone);
  if (!target) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
      }}
    >
      <a
        href={`tel:${target}`}
        aria-label={`Call ${name}`}
        className="contact-icon-btn"
      >
        <PhoneIcon />
      </a>
      <a
        href={`sms:${target}`}
        aria-label={`Message ${name}`}
        className="contact-icon-btn"
      >
        <MessageIcon />
      </a>
    </span>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
