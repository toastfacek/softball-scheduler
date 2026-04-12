"use server";

import { canManageLineups, canManageTeam } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";

export async function requireViewer() {
  const viewer = await getViewerContext();

  if (!viewer) {
    throw new Error("You need to sign in first.");
  }

  return viewer;
}

export async function requireTeamManager() {
  const viewer = await requireViewer();

  if (!canManageTeam(viewer)) {
    throw new Error("Only coaches and team admins can do that.");
  }

  return viewer;
}

export async function requireLineupManager() {
  const viewer = await requireViewer();

  if (!canManageLineups(viewer)) {
    throw new Error("Only coaches and team admins can edit lineups.");
  }

  return viewer;
}

