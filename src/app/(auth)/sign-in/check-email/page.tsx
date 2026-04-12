import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="auth-shell">
      <div className="auth-mark">
        <div className="auth-logo">
          <MailIcon />
        </div>
        <h1 className="auth-title">Check your inbox</h1>
        <p className="auth-sub">
          Magic link sent. Tap it on this device to sign in. Expires in 24
          hours.
        </p>
      </div>

      <Link href="/sign-in" className="auth-back-link">
        Back to sign in
      </Link>
    </main>
  );
}

function MailIcon() {
  return (
    <svg
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
