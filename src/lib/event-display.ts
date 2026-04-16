import type { EventType } from "@/db/schema";

export function eventTypeLabel(type: EventType): string {
  switch (type) {
    case "GAME":
      return "Game";
    case "PRACTICE":
      return "Practice";
    case "TEAM_EVENT":
      return "Team event";
  }
}

export function eventTypeCalendarClass(type: EventType): string {
  switch (type) {
    case "GAME":
      return "cal-event--game";
    case "PRACTICE":
      return "cal-event--practice";
    case "TEAM_EVENT":
      return "cal-event--team-event";
  }
}
