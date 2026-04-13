import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { TEAM_ROLE_LABELS } from "@/lib/constants";
import type { TeamRole } from "@/db/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildEmailFromAddress(address: string, displayName: string) {
  const trimmedAddress = address.trim();
  const trimmedDisplayName = displayName.trim();

  if (!trimmedAddress || !trimmedDisplayName) {
    return trimmedAddress;
  }

  const match = trimmedAddress.match(/<([^>]+)>/);
  const emailOnly = match?.[1]?.trim() ?? trimmedAddress;

  return `${trimmedDisplayName} <${emailOnly}>`;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function displayName({
  name,
  fallback,
}: {
  name?: string | null;
  fallback: string;
}) {
  return name?.trim() || fallback;
}

export function fullName(
  firstName: string,
  lastName: string,
  preferredName?: string | null,
) {
  return `${preferredName?.trim() || firstName} ${lastName}`.trim();
}

export function roleLabel(role: TeamRole) {
  return TEAM_ROLE_LABELS[role];
}

export function toSentenceList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function markdownishToHtml(value: string) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export function formatAddress(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function googleMapsHref(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function appleMapsHref(address: string) {
  return `http://maps.apple.com/?q=${encodeURIComponent(address)}`;
}
