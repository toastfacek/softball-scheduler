import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center">
        <section className="shell-panel relative w-full overflow-hidden rounded-[2.5rem] p-8 text-center sm:p-12">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--orange-strong),color-mix(in_srgb,var(--orange)_70%,white),var(--orange-strong))]" />
          <div className="mx-auto mb-5 flex h-18 w-18 items-center justify-center rounded-[1.5rem] bg-[var(--navy-strong)] text-[var(--orange)]">
            <MailCheck className="h-8 w-8" />
          </div>
          <div className="space-y-4">
            <div className="eyebrow">Magic link sent</div>
            <h1 className="text-5xl text-[var(--navy-strong)]">Check your inbox</h1>
            <p className="mx-auto max-w-lg text-base leading-7 font-medium text-[color-mix(in_srgb,var(--navy)_72%,white)]">
              Your magic link is on the way. Open it on the same device and
              you’ll land straight inside the team app.
            </p>
          </div>
          <Link
            href="/sign-in"
            className="mt-8 inline-flex rounded-[1rem] border border-[var(--line)] bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[var(--navy-strong)]"
          >
            Back to sign in
          </Link>
        </section>
      </div>
    </main>
  );
}
