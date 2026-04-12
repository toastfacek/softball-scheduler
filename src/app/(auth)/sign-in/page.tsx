import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInForm } from "@/components/sign-in-form";

type SignInPageProps = {
  searchParams?: Promise<{
    email?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/schedule");
  }

  const params = (await searchParams) ?? {};

  return (
    <main className="auth-shell">
      <div className="auth-mark">
        <div className="auth-logo">
          <ShieldIcon />
        </div>
        <h1 className="auth-title">Sign in to BGSL</h1>
      </div>

      <section className="shell-panel auth-card">
        <div className="orange-bar-top" />
        <div className="relative flex flex-col gap-4">
          <SignInForm defaultEmail={params.email ?? ""} />
        </div>
      </section>

      <p className="auth-footnote">
        Not on the roster? Ask a coach to add your email first.
      </p>
    </main>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="26"
      height="26"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
