import type { TeamRole } from "@/db/schema";

export type ViewerContext = {
  userId: string;
  teamId: string;
  seasonId: string | null;
  roles: TeamRole[];
  linkedPlayerIds: string[];
};

export function hasRole(viewer: ViewerContext | null, roles: TeamRole[]) {
  if (!viewer) return false;
  return roles.some((role) => viewer.roles.includes(role));
}

export function canManageTeam(viewer: ViewerContext | null) {
  return hasRole(viewer, ["COACH", "ADMIN"]);
}

export function canManageLineups(viewer: ViewerContext | null) {
  return hasRole(viewer, ["COACH", "ADMIN"]);
}

export function canManagePrivateContacts(viewer: ViewerContext | null) {
  return hasRole(viewer, ["COACH", "ADMIN"]);
}

