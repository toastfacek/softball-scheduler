import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signOutAction } from "@/actions/auth-actions";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { getViewerContext } from "@/lib/data";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const viewer = await getViewerContext();

  if (!viewer) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center">
          <section className="shell-panel relative w-full overflow-hidden rounded-[2.5rem] p-8 sm:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--orange-strong),color-mix(in_srgb,var(--orange)_70%,white),var(--orange-strong))]" />
            <div className="space-y-4">
              <div className="eyebrow">Roster access pending</div>
              <h1 className="text-5xl text-[var(--navy-strong)]">
                Your account is real, but it isn’t linked to a team yet.
              </h1>
              <p className="text-base leading-7 font-medium text-[color-mix(in_srgb,var(--navy)_74%,white)]">
                Ask a coach or team admin to add your invited email on the Team
                screen. Once they do, sign in again and the full app will open.
              </p>
            </div>
            <form action={signOutAction} className="mt-8">
              <SubmitButton label="Sign out" />
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <AppShell
      teamName={viewer.team.name}
      seasonName={viewer.seasonName}
      roles={viewer.roles}
    >
      {children}
    </AppShell>
  );
}
