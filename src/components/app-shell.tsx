"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  Flame,
  Shield,
  Users,
} from "lucide-react";

import type { TeamRole } from "@/db/schema";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/schedule",
    label: "Schedule",
    icon: CalendarClock,
    roles: null,
  },
  {
    href: "/team",
    label: "Team",
    icon: Users,
    roles: null,
  },
  {
    href: "/lineups",
    label: "Lineups",
    icon: ClipboardList,
    roles: ["COACH", "ADMIN"] satisfies TeamRole[],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Shield,
    roles: null,
  },
];

type AppShellProps = {
  teamName: string;
  seasonName: string | null;
  roles: TeamRole[];
  children: React.ReactNode;
};

export function AppShell({
  teamName,
  seasonName,
  roles,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  const visibleNav = navigation.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => roles.includes(role));
  });

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--navy)_30%,black)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--navy-strong)_96%,black),color-mix(in_srgb,var(--navy)_88%,var(--harbor)))] px-5 py-6 text-white shadow-[0_28px_60px_color-mix(in_srgb,var(--navy-strong)_24%,transparent)] sm:px-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--orange)_30%,transparent),transparent_32%),repeating-linear-gradient(125deg,color-mix(in_srgb,white_7%,transparent)_0_2px,transparent_2px_44px)]" />
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,var(--orange-strong),color-mix(in_srgb,var(--orange)_75%,white),var(--orange-strong))]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="eyebrow flex items-center gap-2 text-[color-mix(in_srgb,var(--orange)_82%,white)]">
                <Flame className="h-3.5 w-3.5 text-[var(--orange)]" />
                Beverly Girls Softball League
              </div>
              <h1 className="text-4xl leading-none text-white sm:text-5xl">
                {teamName}
              </h1>
              <p className="max-w-2xl text-sm font-medium text-white/78 sm:text-base">
                Attendance, schedule changes, and lineup decisions in one
                sideline-ready league hub.
              </p>
            </div>
            <div className="hidden min-w-[190px] rounded-[1.25rem] border border-white/12 bg-white/8 px-4 py-4 text-right sm:block">
              <div className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-white/55">
                Active roles
              </div>
              <div className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/82">
                {roles.join(" · ")}
              </div>
            </div>
          </div>

          <div className="relative mt-6 flex flex-wrap gap-3 text-sm">
            <div className="rounded-[1rem] border border-white/12 bg-white/8 px-4 py-2 font-semibold text-white/78">
              {seasonName ?? "Current season"}
            </div>
            <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--orange)_36%,transparent)] bg-[color-mix(in_srgb,var(--orange)_18%,transparent)] px-4 py-2 font-semibold text-[color-mix(in_srgb,var(--orange)_82%,white)]">
              Built for fast family response and cleaner game-day planning
            </div>
          </div>
        </header>

        <div>{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-3 z-30 mx-auto w-[calc(100%-1rem)] max-w-xl rounded-[1.5rem] border border-[color-mix(in_srgb,var(--navy)_14%,white)] bg-[color-mix(in_srgb,var(--navy-strong)_94%,black)] p-2 shadow-[0_24px_50px_color-mix(in_srgb,var(--navy-strong)_28%,transparent)] backdrop-blur xl:left-6 xl:right-auto xl:top-6 xl:bottom-auto xl:mx-0 xl:w-72 xl:p-3">
        <div className="grid grid-cols-4 gap-2 xl:grid-cols-1">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[1rem] px-2 py-3 text-[0.68rem] font-black uppercase tracking-[0.14em] text-white/66 xl:flex-row xl:justify-start xl:px-4 xl:text-sm",
                  !active && "hover:bg-white/7 hover:text-white",
                  active &&
                    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--orange)_94%,white),var(--orange-strong))] text-[var(--navy-strong)] shadow-[0_16px_30px_color-mix(in_srgb,var(--orange-strong)_22%,transparent)]",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
