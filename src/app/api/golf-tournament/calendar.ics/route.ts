import { NextResponse } from "next/server";

import {
  GOLF_TOURNAMENT_ADDRESS,
  GOLF_TOURNAMENT_END,
  GOLF_TOURNAMENT_SAFE_PROCEEDS,
  GOLF_TOURNAMENT_START,
  GOLF_TOURNAMENT_TITLE,
  GOLF_TOURNAMENT_VENUE,
} from "@/lib/golf-tournament/event";
import { buildTeamCalendar } from "@/lib/ical";
import { env } from "@/lib/env";

export async function GET() {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const calendar = buildTeamCalendar({
    calName: GOLF_TOURNAMENT_TITLE,
    timezone: "America/New_York",
    appUrl,
    uidDomain: "beverlysoftball.com",
    events: [
      {
        id: "bgsl-golf-tournament-2026",
        type: "TEAM_EVENT",
        status: "SCHEDULED",
        title: GOLF_TOURNAMENT_TITLE,
        description: `Postponed due to inclement weather. Registration begins at 9:00 AM; shotgun start at 10:00 AM.\n\n${GOLF_TOURNAMENT_SAFE_PROCEEDS}\n\nTournament details: ${appUrl}/golf-tournament`,
        startsAt: GOLF_TOURNAMENT_START,
        endsAt: GOLF_TOURNAMENT_END,
        venueName: GOLF_TOURNAMENT_VENUE,
        addressLine1: GOLF_TOURNAMENT_ADDRESS,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        updatedAt: new Date("2026-09-27T10:13:20-04:00"),
      },
    ],
  });

  return new NextResponse(calendar, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition":
        'attachment; filename="bgsl-golf-tournament.ics"',
    },
  });
}
