import type { TeamRole } from "@/db/schema";

export const APP_TIMEZONE = "America/New_York";

export const DEFAULT_TEAM_COLORS = {
  primary: "#1f3157",
  secondary: "#f28f3b",
  accent: "#6bb8c7",
};

export const DEFAULT_TEAM_POSITIONS = [
  { code: "P", label: "Pitcher", sortOrder: 10 },
  { code: "C", label: "Catcher", sortOrder: 20 },
  { code: "1B", label: "First Base", sortOrder: 30 },
  { code: "2B", label: "Second Base", sortOrder: 40 },
  { code: "3B", label: "Third Base", sortOrder: 50 },
  { code: "SS", label: "Shortstop", sortOrder: 60 },
  { code: "LF", label: "Left Field", sortOrder: 70 },
  { code: "CF", label: "Center Field", sortOrder: 80 },
  { code: "RF", label: "Right Field", sortOrder: 90 },
  { code: "ROV", label: "Rover", sortOrder: 100 },
  { code: "BENCH", label: "Bench", sortOrder: 110 },
] as const;

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  PARENT: "Parent",
  COACH: "Coach",
  ADMIN: "Admin",
};

