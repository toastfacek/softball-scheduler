import { redirect } from "next/navigation";
import { Shield, Zap } from "lucide-react";

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
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="order-2 relative overflow-hidden rounded-[2.5rem] border border-[color-mix(in_srgb,var(--navy)_26%,black)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--navy-strong)_96%,black),color-mix(in_srgb,var(--navy)_88%,var(--harbor)))] p-8 text-white shadow-[0_28px_60px_color-mix(in_srgb,var(--navy-strong)_24%,transparent)] sm:p-10 lg:order-1">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--orange)_32%,transparent),transparent_34%),repeating-linear-gradient(125deg,color-mix(in_srgb,white_7%,transparent)_0_2px,transparent_2px_46px)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-6">
              <div className="eyebrow flex items-center gap-2 text-[color-mix(in_srgb,var(--orange)_82%,white)]">
                <Zap className="h-4 w-4 text-[var(--orange)]" />
                Beverly Girls Softball League
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-5xl leading-[0.9] text-white sm:text-6xl lg:text-[5.5rem]">
                  BGSL keeps players, families, and coaches locked in.
                </h1>
                <p className="max-w-2xl text-lg text-white/76">
                  Attendance, schedule changes, and lineup planning in one
                  fast, sideline-ready app.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Fast entry", "Magic links get families in without password drama."],
                ["Clean responses", "Parents answer once per event with notes when needed."],
                ["Coach control", "Build batting orders and inning plans without spreadsheet drift."],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="rounded-[1.5rem] border border-white/12 bg-white/8 p-5 backdrop-blur-sm"
                >
                  <div className="mb-2 text-[0.72rem] font-black uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--orange)_82%,white)]">
                    {title}
                  </div>
                  <p className="text-sm font-medium text-white/74">
                    {copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="shell-panel order-1 relative flex flex-col gap-10 overflow-hidden rounded-[2.5rem] p-8 sm:p-10 lg:order-2 lg:justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--orange-strong),color-mix(in_srgb,var(--orange)_70%,white),var(--orange-strong))]" />
          <div className="space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-[1rem] bg-[var(--navy-strong)] text-[var(--orange)]">
              <Shield className="h-7 w-7" />
            </div>
            <div className="space-y-3">
              <h2 className="text-4xl text-[var(--navy-strong)]">
                Sign in with your invited email
              </h2>
              <p className="text-sm leading-6 text-[color-mix(in_srgb,var(--navy)_72%,white)]">
                We’ll send a one-time magic link. Coaches and team admins can
                add you first if you have not been invited yet.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <SignInForm defaultEmail={params.email ?? ""} />
            <div className="rounded-[1.25rem] border border-dashed border-[var(--line)] px-4 py-4 text-sm font-medium text-[color-mix(in_srgb,var(--navy)_68%,white)]">
              Not on the roster yet? Ask a coach or team admin to add your email
              on the Team screen first.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
