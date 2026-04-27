import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { adultUsers, events, teamMemberships, teams } from "@/db/schema";
import { env } from "@/lib/env";
import { buildTeamCalendar } from "@/lib/ical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  if (!token || token.length < 8) {
    return notFound();
  }

  const adult = await db.query.adultUsers.findFirst({
    where: eq(adultUsers.calendarSyncToken, token),
  });

  if (!adult) {
    return notFound();
  }

  const membership = await db
    .select({
      teamId: teamMemberships.teamId,
      teamName: teams.name,
      teamTimezone: teams.timezone,
    })
    .from(teamMemberships)
    .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
    .where(eq(teamMemberships.userId, adult.id))
    .orderBy(asc(teams.name))
    .limit(1);

  if (membership.length === 0) {
    return notFound();
  }

  const { teamId, teamName, teamTimezone } = membership[0];

  const teamEvents = await db
    .select({
      id: events.id,
      type: events.type,
      status: events.status,
      title: events.title,
      description: events.description,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venueName: events.venueName,
      addressLine1: events.addressLine1,
      addressLine2: events.addressLine2,
      city: events.city,
      state: events.state,
      postalCode: events.postalCode,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .where(and(eq(events.teamId, teamId)))
    .orderBy(asc(events.startsAt));

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const uidDomain = new URL(appUrl).host || "bgsl";

  const ics = buildTeamCalendar({
    calName: teamName,
    timezone: teamTimezone,
    events: teamEvents,
    appUrl,
    uidDomain,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "Content-Disposition": 'inline; filename="bgsl.ics"',
    },
  });
}

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
