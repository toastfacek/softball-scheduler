import { and, eq } from "drizzle-orm";

import { db } from "../db";
import {
  adultEventResponses,
  adultUsers,
  events,
  playerEventResponses,
  playerGuardians,
  players,
  seasons,
  teamMemberships,
  teamPositionTemplates,
  teams,
} from "../db/schema";
import { DEFAULT_TEAM_COLORS, DEFAULT_TEAM_POSITIONS } from "../lib/constants";
import { normalizeEmail, slugify } from "../lib/utils";

async function ensureAdult(input: {
  name: string;
  email: string;
  phone?: string;
}) {
  const email = normalizeEmail(input.email);
  const existing = await db.query.adultUsers.findFirst({
    where: eq(adultUsers.email, email),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(adultUsers)
    .values({
      name: input.name,
      email,
      phone: input.phone ?? null,
    })
    .returning();

  return created;
}

async function ensureMembership(
  userId: string,
  teamId: string,
  role: "PARENT" | "COACH" | "ADMIN",
) {
  await db
    .insert(teamMemberships)
    .values({
      userId,
      teamId,
      role,
    })
    .onConflictDoNothing();
}

async function main() {
  const teamSlug = slugify("Beverly Girls Softball League");
  let team = await db.query.teams.findFirst({
    where: eq(teams.slug, teamSlug),
  });

  if (!team) {
    [team] = await db
      .insert(teams)
      .values({
        name: "Beverly Girls Softball League",
        slug: teamSlug,
        city: "Beverly",
        state: "MA",
        timezone: "America/New_York",
        primaryColor: DEFAULT_TEAM_COLORS.primary,
        secondaryColor: DEFAULT_TEAM_COLORS.secondary,
        accentColor: DEFAULT_TEAM_COLORS.accent,
      })
      .returning();
  }

  const year = new Date().getFullYear();
  let season = await db.query.seasons.findFirst({
    where: and(eq(seasons.teamId, team.id), eq(seasons.isActive, true)),
  });

  if (!season) {
    [season] = await db
      .insert(seasons)
      .values({
        teamId: team.id,
        name: `${year} Spring Season`,
        year,
        isActive: true,
      })
      .returning();
  }

  const existingPositions = await db.query.teamPositionTemplates.findMany({
    where: eq(teamPositionTemplates.teamId, team.id),
  });

  if (existingPositions.length === 0) {
    await db.insert(teamPositionTemplates).values(
      DEFAULT_TEAM_POSITIONS.map((position) => ({
        teamId: team.id,
        ...position,
        isActive: true,
      })),
    );
  }

  const admin = await ensureAdult({
    name: "Jesse Admin",
    email: "jesse.admin@example.com",
  });
  const leadCoach = await ensureAdult({
    name: "Marta Coach",
    email: "marta.coach@example.com",
    phone: "978-555-0111",
  });
  const assistantCoach = await ensureAdult({
    name: "Dan Assistant",
    email: "dan.coach@example.com",
  });
  const guardianTwo = await ensureAdult({
    name: "Alex Family",
    email: "alex.family@example.com",
  });

  await ensureMembership(admin.id, team.id, "ADMIN");
  await ensureMembership(leadCoach.id, team.id, "COACH");
  await ensureMembership(leadCoach.id, team.id, "PARENT");
  await ensureMembership(assistantCoach.id, team.id, "COACH");
  await ensureMembership(guardianTwo.id, team.id, "PARENT");

  const samplePlayers = [
    {
      firstName: "Emma",
      lastName: "Carter",
      preferredName: "Em",
      jerseyNumber: 7,
      guardianIds: [leadCoach.id],
    },
    {
      firstName: "Sophie",
      lastName: "Nguyen",
      preferredName: null,
      jerseyNumber: 12,
      guardianIds: [guardianTwo.id],
    },
    {
      firstName: "Harper",
      lastName: "Bell",
      preferredName: null,
      jerseyNumber: 24,
      guardianIds: [guardianTwo.id, admin.id],
    },
  ] as const;

  for (const playerInput of samplePlayers) {
    let player = await db.query.players.findFirst({
      where: and(
        eq(players.teamId, team.id),
        eq(players.firstName, playerInput.firstName),
        eq(players.lastName, playerInput.lastName),
      ),
    });

    if (!player) {
      [player] = await db
        .insert(players)
        .values({
          teamId: team.id,
          seasonId: season.id,
          firstName: playerInput.firstName,
          lastName: playerInput.lastName,
          preferredName: playerInput.preferredName,
          jerseyNumber: playerInput.jerseyNumber,
        })
        .returning();
    }

    for (const [index, guardianId] of playerInput.guardianIds.entries()) {
      await db
        .insert(playerGuardians)
        .values({
          playerId: player.id,
          userId: guardianId,
          relationshipLabel: index === 0 ? "Parent" : "Guardian",
          sortOrder: index,
        })
        .onConflictDoNothing();
    }
  }

  const existingEvents = await db.query.events.findMany({
    where: eq(events.teamId, team.id),
  });

  if (existingEvents.length === 0) {
    const practiceStart = new Date();
    practiceStart.setDate(practiceStart.getDate() + 2);
    practiceStart.setHours(17, 30, 0, 0);

    const gameStart = new Date();
    gameStart.setDate(gameStart.getDate() + 5);
    gameStart.setHours(9, 0, 0, 0);

    const pictureDayStart = new Date();
    pictureDayStart.setDate(pictureDayStart.getDate() + 10);
    pictureDayStart.setHours(10, 0, 0, 0);

    const [practice, game] = await db
      .insert(events)
      .values([
        {
          teamId: team.id,
          seasonId: season.id,
          type: "PRACTICE",
          title: "Wednesday team practice",
          startsAt: practiceStart,
          endsAt: new Date(practiceStart.getTime() + 90 * 60 * 1000),
          venueName: "Beverly Common",
          addressLine1: "1 Common St",
          city: "Beverly",
          state: "MA",
          postalCode: "01915",
          description: "Gloves, helmets, water, and black socks.",
        },
        {
          teamId: team.id,
          seasonId: season.id,
          type: "GAME",
          title: "Saturday vs Marblehead",
          startsAt: gameStart,
          endsAt: new Date(gameStart.getTime() + 2 * 60 * 60 * 1000),
          venueName: "Harry Ball Field",
          addressLine1: "120 Cabot St",
          city: "Beverly",
          state: "MA",
          postalCode: "01915",
          description: "Arrive 30 minutes early for warmups.",
        },
        {
          teamId: team.id,
          seasonId: season.id,
          type: "TEAM_EVENT",
          title: "Picture Day",
          startsAt: pictureDayStart,
          endsAt: new Date(pictureDayStart.getTime() + 2 * 60 * 60 * 1000),
          venueName: "Harry Ball Field",
          addressLine1: "120 Cabot St",
          city: "Beverly",
          state: "MA",
          postalCode: "01915",
          description: "Wear full uniform. Individual and team photos.",
        },
      ])
      .returning();

    const teamPlayers = await db.query.players.findMany({
      where: eq(players.teamId, team.id),
      orderBy: [players.jerseyNumber, players.lastName],
    });

    if (teamPlayers[0] && teamPlayers[1]) {
      await db.insert(playerEventResponses).values([
        {
          eventId: practice.id,
          playerId: teamPlayers[0].id,
          status: "AVAILABLE",
          note: "Ready to go.",
          respondedByUserId: leadCoach.id,
        },
        {
          eventId: practice.id,
          playerId: teamPlayers[1].id,
          status: "MAYBE",
          note: "Might be a few minutes late from school pickup.",
          respondedByUserId: guardianTwo.id,
        },
        {
          eventId: game.id,
          playerId: teamPlayers[0].id,
          status: "AVAILABLE",
          respondedByUserId: leadCoach.id,
        },
      ]);

      await db.insert(adultEventResponses).values([
        {
          eventId: practice.id,
          userId: leadCoach.id,
          status: "AVAILABLE",
        },
        {
          eventId: game.id,
          userId: leadCoach.id,
          status: "AVAILABLE",
        },
        {
          eventId: game.id,
          userId: assistantCoach.id,
          status: "MAYBE",
          note: "Coming straight from another field.",
        },
      ]);
    }
  }

  console.log("Softball seed complete.");
  console.log(`Team: ${team.name}`);
  console.log(`Season: ${season.name}`);
  console.log("Sample invited emails:");
  console.log(" - jesse.admin@example.com");
  console.log(" - marta.coach@example.com");
  console.log(" - alex.family@example.com");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

