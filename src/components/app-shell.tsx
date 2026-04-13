"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  CalendarClock,
  ClipboardList,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";

import type { TeamRole } from "@/db/schema";
import { SavedFlash } from "@/components/saved-flash";
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
    icon: SettingsIcon,
    roles: null,
  },
] as const;

type AppShellProps = {
  roles: TeamRole[];
  brandTitle: string;
  brandSubtitle?: string | null;
  children: React.ReactNode;
};

export function AppShell({
  roles,
  brandTitle,
  brandSubtitle,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  const visibleNav = navigation.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => roles.includes(role));
  });

  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        <SavedFlash />
      </Suspense>
      <main className="app-main">{children}</main>
      <nav className="app-bottom-nav">
        <div
          className="app-sidebar-brand"
          style={{
            padding: "0 0.625rem 1rem",
            marginBottom: "1rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-barlow-condensed), sans-serif",
              fontWeight: 700,
              fontSize: "1.05rem",
              lineHeight: 1.1,
              letterSpacing: "0.01em",
              color: "color-mix(in srgb, var(--orange) 88%, white)",
              textTransform: "uppercase",
            }}
          >
            {brandTitle}
          </div>
          {brandSubtitle ? (
            <div
              style={{
                marginTop: "0.35rem",
                fontSize: "0.7rem",
                lineHeight: 1.3,
                color: "rgba(255, 255, 255, 0.55)",
                letterSpacing: "0.04em",
              }}
            >
              {brandSubtitle}
            </div>
          ) : null}
        </div>
        <div className="app-bottom-nav-inner">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "app-nav-item",
                  active && "app-nav-item--active",
                )}
              >
                <Icon className="app-nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
