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
        description: `${GOLF_TOURNAMENT_SAFE_PROCEEDS}\n\nRegister or sponsor: ${appUrl}/golf-tournament`,
        startsAt: GOLF_TOURNAMENT_START,
        endsAt: GOLF_TOURNAMENT_END,
        venueName: GOLF_TOURNAMENT_VENUE,
        addressLine1: GOLF_TOURNAMENT_ADDRESS,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        updatedAt: new Date("2026-06-17T00:00:00-04:00"),
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
