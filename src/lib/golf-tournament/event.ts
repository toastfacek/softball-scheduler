import { env } from "@/lib/env";

export const GOLF_TOURNAMENT_TITLE = "Tee Up for Beverly Girls Softball";
// Set this to false when the tournament can accept additional golfer entries.
export const GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED = true;
export const GOLF_TOURNAMENT_START = new Date("2026-09-28T10:00:00-04:00");
export const GOLF_TOURNAMENT_END = new Date("2026-09-28T16:00:00-04:00");
export const GOLF_TOURNAMENT_VENUE = "Beverly Golf & Tennis Club";
export const GOLF_TOURNAMENT_ADDRESS =
  "134 McKay Street, Beverly, MA 01915";
export const GOLF_TOURNAMENT_SAFE_PROCEEDS =
  "Proceeds support BGSL programming, equipment, scholarships, field improvements, and opportunities for girls across Beverly.";

export function golfTournamentContactEmail() {
  return env.GOLF_TOURNAMENT_CONTACT_EMAIL.trim();
}

export function golfTournamentAdminEmails() {
  return Array.from(
    new Set([
      ...env.GOLF_TOURNAMENT_ADMIN_EMAILS
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
      "mishlambert10@gmail.com",
    ]),
  );
}
