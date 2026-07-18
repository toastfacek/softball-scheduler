import { redirect } from "next/navigation";

import { signInGolfAdminAction } from "@/actions/golf-admin-actions";
import { SubmitButton } from "@/components/submit-button";
import {
  hasGolfAdminSession,
  isGolfAdminConfigured,
} from "@/lib/golf-tournament/admin-auth";

type GolfAdminLoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function GolfAdminLoginPage({
  searchParams,
}: GolfAdminLoginPageProps) {
  if (await hasGolfAdminSession()) {
    redirect("/golf-admin");
  }

  const params = (await searchParams) ?? {};
  const configured = isGolfAdminConfigured();

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[75vh] max-w-lg items-center">
        <section className="shell-panel w-full space-y-6 p-7 sm:p-9">
          <div className="space-y-2">
            <p className="eyebrow">Tournament administration</p>
            <h1 className="text-5xl text-navy-strong">Golf admin</h1>
            <p className="text-sm leading-6 text-navy-soft">
              Enter the tournament admin password to review registrations,
              sponsors, payments, and raffle submissions.
            </p>
          </div>

          {!configured || params.error === "setup" ? (
            <div className="saved-flash">
              Golf admin authentication still needs its production password and
              session secret.
            </div>
          ) : null}

          {params.error === "invalid" ? (
            <div className="saved-flash" role="alert">
              That password wasn’t recognized.
            </div>
          ) : null}

          <form action={signInGolfAdminAction} className="space-y-4">
            <label className="field-stack">
              <span>Admin password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={!configured}
              />
            </label>
            <SubmitButton
              label="Open tournament dashboard"
              disabled={!configured}
            />
          </form>
        </section>
      </div>
    </main>
  );
}
