"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  Settings as SettingsIcon,
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
    icon: SettingsIcon,
    roles: null,
  },
] as const;

type AppShellProps = {
  roles: TeamRole[];
  children: React.ReactNode;
};

export function AppShell({ roles, children }: AppShellProps) {
  const pathname = usePathname();

  const visibleNav = navigation.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => roles.includes(role));
  });

  return (
    <div className="app-shell">
      <main className="app-main">{children}</main>
      <nav className="app-bottom-nav">
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
