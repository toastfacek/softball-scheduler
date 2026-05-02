import { cache } from "react";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lt,
  sql,
} from "drizzle-orm";
import { addHours } from "date-fns";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  adultEventResponses,
  adultUsers,
  battingSlots,
  events,
  inningAssignments,
  lineupPlans,
  lineupPresetAssignments,
  lineupPresetSlots,
  lineupPresets,
  playerEventResponses,
  playerGuardians,
  players,
  reminderDeliveries,
  seasons,
  teamMemberships,
  teamPositionTemplates,
  teams,
  type AttendanceStatus,
  type TeamRole,
} from "@/db/schema";
import type { ViewerContext } from "@/lib/authz";
import { fullName } from "@/lib/utils";

export type LinkedPlayer = {
  id: string;
  name: string;
};

export type AppViewer = ViewerContext & {
  adult: {
    name: string | null;
    email: string;
    phone: string | null;
    reminderOptIn: boolean;
    textOptIn: boolean;
  };
  team: {
    name: string;
    brandSubtitle: string | null;
    slug: string;
    city: string;
    state: string;
    timezone: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  seasonName: string | null;
  linkedPlayers: LinkedPlayer[];
};

export const getViewerContext = cache(async (): Promise<AppViewer | null> => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const adult = await db.query.adultUsers.findFirst({
    where: eq(adultUsers.id, session.user.id),
  });

  if (!adult?.email) {
    return null;
  }

  const membershipRows = await db
    .select({
      teamId: teamMemberships.teamId,
      role: teamMemberships.role,
      teamName: teams.name,
      teamBrandSubtitle: teams.brandSubtitle,
      teamSlug: teams.slug,
      teamCity: teams.city,
      teamState: teams.state,
      timezone: teams.timezone,
      primaryColor: teams.primaryColor,
      secondaryColor: teams.secondaryColor,
      accentColor: teams.accentColor,
      seasonId: seasons.id,
      seasonName: seasons.name,
    })
    .from(teamMemberships)
    .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
    .leftJoin(
      seasons,
      and(eq(seasons.teamId, teams.id), eq(seasons.isActive, true)),
    )
    .where(eq(teamMemberships.userId, session.user.id))
    .orderBy(asc(teams.name));

  if (membershipRows.length === 0) {
    return null;
  }

  const teamId = membershipRows[0].teamId;
  const teamRows = membershipRows.filter((row) => row.teamId === teamId);

  const linkedPlayerRows = await db
    .select({
      playerId: playerGuardians.playerId,
      firstName: players.firstName,
      lastName: players.lastName,
      preferredName: players.preferredName,
    })
    .from(playerGuardians)
    .innerJoin(players, eq(playerGuardians.playerId, players.id))
    .where(
      and(
        eq(playerGuardians.userId, session.user.id),
        eq(players.teamId, teamId),
      ),
    )
    .orderBy(asc(players.lastName), asc(players.firstName));

  return {
    userId: session.user.id,
    teamId,
    seasonId: teamRows[0].seasonId,
    roles: teamRows.map((row) => row.role),
    linkedPlayerIds: linkedPlayerRows.map((row) => row.playerId),
    adult: {
      name: adult.name,
      email: adult.email,
      phone: adult.phone,
      reminderOptIn: adult.reminderOptIn,
      textOptIn: adult.textOptIn,
    },
    team: {
      name: teamRows[0].teamName,
      brandSubtitle: teamRows[0].teamBrandSubtitle,
      slug: teamRows[0].teamSlug,
      city: teamRows[0].teamCity,
      state: teamRows[0].teamState,
      timezone: teamRows[0].timezone,
      primaryColor: teamRows[0].primaryColor,
      secondaryColor: teamRows[0].secondaryColor,
      accentColor: teamRows[0].accentColor,
    },
    seasonName: teamRows[0].seasonName,
    linkedPlayers: linkedPlayerRows.map((row) => ({
      id: row.playerId,
      name: fullName(row.firstName, row.lastName, row.preferredName),
    })),
  };
});

function buildPlayerResponseMap<
  T extends {
    eventId: string;
    playerId: string;
    status: AttendanceStatus;
    note: string | null;
    actualAttendance: string;
  },
>(responses: T[]) {
  return new Map(
    responses.map((response) => [
      `${response.eventId}:${response.playerId}`,
      response,
    ]),
  );
}

function buildAdultResponseMap<
  T extends {
    eventId: string;
    userId: string;
    status: AttendanceStatus;
    note: string | null;
    actualAttendance: string;
  },
>(responses: T[]) {
  return new Map(
    responses.map((response) => [`${response.eventId}:${response.userId}`, response]),
  );
}

function summarizePlayerStatuses(
  eventId: string,
  teamPlayers: { id: string }[],
  responseMap: Map<
    string,
    {
      status: AttendanceStatus;
    }
  >,
) {
  const summary = {
    AVAILABLE: 0,
    UNAVAILABLE: 0,
    MAYBE: 0,
    pending: 0,
  };

  for (const player of teamPlayers) {
    const response = responseMap.get(`${eventId}:${player.id}`);

    if (!response) {
      summary.pending += 1;
      continue;
    }

    summary[response.status] += 1;
  }

  return summary;
}

export async function getSchedulePageData(viewer: AppViewer) {
  const teamPlayers = await db.query.players.findMany({
    where: eq(players.teamId, viewer.teamId),
    orderBy: [asc(players.lastName), asc(players.firstName)],
  });

  // No row limit: the desktop calendar navigates month-to-month and would
  // render misleadingly-empty months if we capped here. A single team across
  // one season is at most ~100 events, which is fine to load in full.
  const eventRows = await db.query.events.findMany({
    where: eq(events.teamId, viewer.teamId),
    orderBy: [asc(events.startsAt)],
  });

  const eventIds = eventRows.map((event) => event.id);

  const [playerResponses, adultResponses] = eventIds.length
    ? await Promise.all([
        db.query.playerEventResponses.findMany({
          where: inArray(playerEventResponses.eventId, eventIds),
        }),
        db.query.adultEventResponses.findMany({
          where: inArray(adultEventResponses.eventId, eventIds),
        }),
      ])
    : [[], []];

  const playerResponseMap = buildPlayerResponseMap(playerResponses);
  const adultResponseMap = buildAdultResponseMap(adultResponses);

  const cards = eventRows.map((event) => {
    const playerSummary = summarizePlayerStatuses(
      event.id,
      teamPlayers,
      playerResponseMap,
    );

    return {
      ...event,
      playerSummary,
      viewerPlayers: viewer.linkedPlayers.map((player) => ({
        ...player,
        response:
          playerResponseMap.get(`${event.id}:${player.id}`)?.status ?? null,
      })),
      viewerAdultResponse:
        adultResponseMap.get(`${event.id}:${viewer.userId}`)?.status ?? null,
    };
  });

  const nextEvent = cards.find((event) => event.status !== "COMPLETED") ?? null;
  const needsResponseCount = cards.reduce((count, event) => {
    return (
      count +
      event.viewerPlayers.filter((player) => player.response === null).length
    );
  }, 0);

  return {
    events: cards,
    nextEvent,
    roster: teamPlayers.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      preferredName: p.preferredName,
      jerseyNumber: p.jerseyNumber,
    })),
    stats: {
      playerCount: teamPlayers.length,
      coachCount: adultResponses.length,
      needsResponseCount,
    },
  };
}

export async function getEventPageData(viewer: AppViewer, eventId: string) {
  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.teamId, viewer.teamId)),
  });

  if (!event) {
    return null;
  }

  const [teamPlayers, playerResponses, staffRows, adultResponses] =
    await Promise.all([
      db.query.players.findMany({
        where: eq(players.teamId, viewer.teamId),
        orderBy: [asc(players.lastName), asc(players.firstName)],
      }),
      db.query.playerEventResponses.findMany({
        where: eq(playerEventResponses.eventId, eventId),
      }),
      db
        .select({
          userId: adultUsers.id,
          name: adultUsers.name,
          email: adultUsers.email,
          phone: adultUsers.phone,
          role: teamMemberships.role,
        })
        .from(teamMemberships)
        .innerJoin(adultUsers, eq(teamMemberships.userId, adultUsers.id))
        .where(eq(teamMemberships.teamId, viewer.teamId))
        .orderBy(asc(adultUsers.name), asc(adultUsers.email)),
      db.query.adultEventResponses.findMany({
        where: eq(adultEventResponses.eventId, eventId),
      }),
    ]);

  const playerResponseMap = buildPlayerResponseMap(playerResponses);
  const adultResponseMap = buildAdultResponseMap(adultResponses);

  const playerCards = teamPlayers.map((player) => ({
    id: player.id,
    name: fullName(player.firstName, player.lastName, player.preferredName),
    response: playerResponseMap.get(`${eventId}:${player.id}`) ?? null,
  }));

  const playerSummary = summarizePlayerStatuses(
    eventId,
    teamPlayers,
    playerResponseMap,
  );

  const staffByUser = new Map<
    string,
    {
      userId: string;
      name: string;
      email: string;
      phone: string | null;
      roles: TeamRole[];
      response:
        | (typeof adultResponses)[number]
        | null;
    }
  >();

  for (const row of staffRows) {
    const existing = staffByUser.get(row.userId);

    if (existing) {
      if (!existing.roles.includes(row.role)) {
        existing.roles.push(row.role);
      }
      continue;
    }

    staffByUser.set(row.userId, {
      userId: row.userId,
      name: row.name || row.email,
      email: row.email,
      phone: row.phone,
      roles: [row.role],
      response: adultResponseMap.get(`${eventId}:${row.userId}`) ?? null,
    });
  }

  const staff = Array.from(staffByUser.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  return {
    event,
    playerCards,
    playerSummary,
    staff,
    viewerPlayers: viewer.linkedPlayers.map((player) => ({
      ...player,
      response: playerResponseMap.get(`${eventId}:${player.id}`) ?? null,
    })),
    viewerAdultResponse: adultResponseMap.get(`${eventId}:${viewer.userId}`) ?? null,
  };
}

export async function getTeamPageData(viewer: AppViewer) {
  const [playerRows, guardianRows, staffRows, positionRows] = await Promise.all([
    db.query.players.findMany({
      where: eq(players.teamId, viewer.teamId),
      orderBy: [asc(players.lastName), asc(players.firstName)],
    }),
    db
      .select({
        playerId: playerGuardians.playerId,
        userId: adultUsers.id,
        name: adultUsers.name,
        email: adultUsers.email,
        phone: adultUsers.phone,
        relationshipLabel: playerGuardians.relationshipLabel,
        sortOrder: playerGuardians.sortOrder,
      })
      .from(playerGuardians)
      .innerJoin(adultUsers, eq(playerGuardians.userId, adultUsers.id))
      .innerJoin(players, eq(playerGuardians.playerId, players.id))
      .where(eq(players.teamId, viewer.teamId))
      .orderBy(asc(playerGuardians.sortOrder), asc(adultUsers.name)),
    db
      .select({
        userId: adultUsers.id,
        name: adultUsers.name,
        email: adultUsers.email,
        phone: adultUsers.phone,
        role: teamMemberships.role,
        title: teamMemberships.title,
      })
      .from(teamMemberships)
      .innerJoin(adultUsers, eq(teamMemberships.userId, adultUsers.id))
      .where(eq(teamMemberships.teamId, viewer.teamId))
      .orderBy(asc(adultUsers.name), asc(adultUsers.email)),
    db.query.teamPositionTemplates.findMany({
      where: eq(teamPositionTemplates.teamId, viewer.teamId),
      orderBy: [asc(teamPositionTemplates.sortOrder), asc(teamPositionTemplates.label)],
    }),
  ]);

  const guardiansByPlayer = new Map<
    string,
    {
      userId: string;
      name: string | null;
      email: string;
      phone: string | null;
      relationshipLabel: string;
      sortOrder: number;
    }[]
  >();

  for (const guardian of guardianRows) {
    const existing = guardiansByPlayer.get(guardian.playerId) ?? [];
    existing.push(guardian);
    guardiansByPlayer.set(guardian.playerId, existing);
  }

  const staffByUser = new Map<
    string,
    {
      userId: string;
      name: string | null;
      email: string;
      phone: string | null;
      roles: TeamRole[];
      titles: string[];
    }
  >();

  for (const row of staffRows) {
    const existing = staffByUser.get(row.userId);
    if (existing) {
      if (!existing.roles.includes(row.role)) {
        existing.roles.push(row.role);
      }
      if (row.title && !existing.titles.includes(row.title)) {
        existing.titles.push(row.title);
      }
      continue;
    }

    staffByUser.set(row.userId, {
      userId: row.userId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      roles: [row.role],
      titles: row.title ? [row.title] : [],
    });
  }

  return {
    players: playerRows.map((player) => ({
      ...player,
      displayName: fullName(
        player.firstName,
        player.lastName,
        player.preferredName,
      ),
      guardians: guardiansByPlayer.get(player.id) ?? [],
    })),
    staff: Array.from(staffByUser.values())
      .sort((left, right) => (left.name || left.email).localeCompare(right.name || right.email)),
    positions: positionRows,
  };
}

export async function getLineupsIndexData(viewer: AppViewer) {
  const [games, existingLineups, playerCountRow] = await Promise.all([
    db.query.events.findMany({
      where: and(eq(events.teamId, viewer.teamId), eq(events.type, "GAME")),
      orderBy: [asc(events.startsAt)],
    }),
    db.query.lineupPlans.findMany({
      where: eq(lineupPlans.teamId, viewer.teamId),
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(players)
      .where(eq(players.teamId, viewer.teamId)),
  ]);

  const existingLineupIds = new Set(existingLineups.map((lineup) => lineup.eventId));

  return {
    games: games.map((game) => ({
      ...game,
      hasLineup: existingLineupIds.has(game.id),
    })),
    playerCount: playerCountRow[0]?.count ?? 0,
  };
}

export async function getLineupEditorData(viewer: AppViewer, eventId: string) {
  const [event, positionRows, playerRows, responseRows, existingLineup] =
    await Promise.all([
      db.query.events.findFirst({
        where: and(
          eq(events.id, eventId),
          eq(events.teamId, viewer.teamId),
          eq(events.type, "GAME"),
        ),
      }),
      db.query.teamPositionTemplates.findMany({
        where: and(
          eq(teamPositionTemplates.teamId, viewer.teamId),
          eq(teamPositionTemplates.isActive, true),
        ),
        orderBy: [asc(teamPositionTemplates.sortOrder), asc(teamPositionTemplates.label)],
      }),
      db.query.players.findMany({
        where: eq(players.teamId, viewer.teamId),
        orderBy: [asc(players.lastName), asc(players.firstName)],
      }),
      db.query.playerEventResponses.findMany({
        where: eq(playerEventResponses.eventId, eventId),
      }),
      db.query.lineupPlans.findFirst({
        where: eq(lineupPlans.eventId, eventId),
      }),
    ]);

  if (!event) {
    return null;
  }

  const responseMap = buildPlayerResponseMap(responseRows);
  const battingRows = existingLineup
    ? await db.query.battingSlots.findMany({
        where: eq(battingSlots.lineupPlanId, existingLineup.id),
        orderBy: [asc(battingSlots.slotNumber)],
      })
    : [];
  const assignmentRows = existingLineup
    ? await db.query.inningAssignments.findMany({
        where: eq(inningAssignments.lineupPlanId, existingLineup.id),
        orderBy: [
          asc(inningAssignments.inningNumber),
          asc(inningAssignments.positionCode),
        ],
      })
    : [];

  const battingBySlot = new Map(
    battingRows.map((row) => [row.slotNumber, row.playerId]),
  );
  const assignmentMap = new Map(
    assignmentRows.map((row) => [
      `${row.inningNumber}:${row.playerId}`,
      row.positionCode,
    ]),
  );

  const playersWithStatus = playerRows.map((player) => {
    const response = responseMap.get(`${eventId}:${player.id}`) ?? null;
    return {
      ...player,
      displayName: fullName(
        player.firstName,
        player.lastName,
        player.preferredName,
      ),
      eventStatus: response?.status ?? null,
      response,
    };
  });

  const eligiblePlayers = playersWithStatus.filter(
    (player) => player.eventStatus !== "UNAVAILABLE",
  );
  const unavailablePlayers = playersWithStatus.filter(
    (player) => player.eventStatus === "UNAVAILABLE",
  );

  return {
    event,
    positions: positionRows,
    inningsCount: existingLineup?.inningsCount ?? 6,
    battingBySlot,
    assignmentMap,
    eligiblePlayers,
    unavailablePlayers,
    allPlayers: playersWithStatus,
  };
}

export async function listLineupPresets(viewer: AppViewer) {
  const rows = await db.query.lineupPresets.findMany({
    where: eq(lineupPresets.teamId, viewer.teamId),
    orderBy: [asc(lineupPresets.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    inningsCount: row.inningsCount,
    updatedAt: row.updatedAt,
  }));
}

export async function getLineupPresetEditorData(
  viewer: AppViewer,
  presetId: string,
) {
  const [preset, slotRows, assignmentRows, positionRows, playerRows] =
    await Promise.all([
      db.query.lineupPresets.findFirst({
        where: and(
          eq(lineupPresets.id, presetId),
          eq(lineupPresets.teamId, viewer.teamId),
        ),
      }),
      db.query.lineupPresetSlots.findMany({
        where: eq(lineupPresetSlots.presetId, presetId),
      }),
      db.query.lineupPresetAssignments.findMany({
        where: eq(lineupPresetAssignments.presetId, presetId),
      }),
      db.query.teamPositionTemplates.findMany({
        where: and(
          eq(teamPositionTemplates.teamId, viewer.teamId),
          eq(teamPositionTemplates.isActive, true),
        ),
        orderBy: [
          asc(teamPositionTemplates.sortOrder),
          asc(teamPositionTemplates.label),
        ],
      }),
      db.query.players.findMany({
        where: eq(players.teamId, viewer.teamId),
        orderBy: [asc(players.lastName), asc(players.firstName)],
      }),
    ]);

  if (!preset) return null;

  const battingBySlot = new Map<number, string>();
  for (const slot of slotRows) {
    battingBySlot.set(slot.slotNumber, slot.playerId);
  }

  const assignmentMap = new Map<string, string>();
  for (const assignment of assignmentRows) {
    assignmentMap.set(
      `${assignment.inningNumber}:${assignment.playerId}`,
      assignment.positionCode,
    );
  }

  return {
    preset,
    battingBySlot,
    assignmentMap,
    positions: positionRows,
    allPlayers: playerRows.map((p) => ({
      id: p.id,
      displayName: fullName(p.firstName, p.lastName, p.preferredName),
    })),
  };
}

/** Load a preset's batting order + assignments in a form ready to be applied
 *  in the client editor (batting order array, assignments map keyed by
 *  inning:playerId). */
export async function getPresetApplyPayload(
  viewer: AppViewer,
  presetId: string,
) {
  const [preset, slotRows, assignmentRows] = await Promise.all([
    db.query.lineupPresets.findFirst({
      where: and(
        eq(lineupPresets.id, presetId),
        eq(lineupPresets.teamId, viewer.teamId),
      ),
    }),
    db.query.lineupPresetSlots.findMany({
      where: eq(lineupPresetSlots.presetId, presetId),
    }),
    db.query.lineupPresetAssignments.findMany({
      where: eq(lineupPresetAssignments.presetId, presetId),
    }),
  ]);

  if (!preset) return null;

  return {
    inningsCount: preset.inningsCount,
    battingOrder: slotRows
      .sort((a, b) => a.slotNumber - b.slotNumber)
      .map((s) => s.playerId),
    assignments: assignmentRows.map((a) => ({
      inningNumber: a.inningNumber,
      playerId: a.playerId,
      positionCode: a.positionCode,
    })),
  };
}

export async function getSettingsPageData(viewer: AppViewer) {
  const membershipRows = await db.query.teamMemberships.findMany({
    where: and(
      eq(teamMemberships.teamId, viewer.teamId),
      eq(teamMemberships.userId, viewer.userId),
    ),
    orderBy: [asc(teamMemberships.role)],
  });

  return {
    roles: membershipRows.map((row) => row.role),
  };
}

export async function listTeamRecipients(
  teamId: string,
  scope: "ALL" | "GUARDIANS" | "STAFF",
) {
  if (scope === "STAFF") {
    const staffRows = await db
      .select({
        userId: adultUsers.id,
        email: adultUsers.email,
        phone: adultUsers.phone,
        textOptIn: adultUsers.textOptIn,
      })
      .from(teamMemberships)
      .innerJoin(adultUsers, eq(teamMemberships.userId, adultUsers.id))
      .where(
        and(
          eq(teamMemberships.teamId, teamId),
          inArray(teamMemberships.role, ["COACH", "ADMIN"]),
        ),
      );

    return dedupeRecipients(staffRows);
  }

  if (scope === "GUARDIANS") {
    const guardianRows = await db
      .select({
        userId: adultUsers.id,
        email: adultUsers.email,
        phone: adultUsers.phone,
        textOptIn: adultUsers.textOptIn,
      })
      .from(playerGuardians)
      .innerJoin(adultUsers, eq(playerGuardians.userId, adultUsers.id))
      .innerJoin(players, eq(playerGuardians.playerId, players.id))
      .where(eq(players.teamId, teamId));

    return dedupeRecipients(guardianRows);
  }

  // Every adult with team access (parents, coaches, admins) has a
  // team_memberships row — the invite flow in team-actions.ts inserts
  // a PARENT membership for every guardian. So a plain teamMemberships
  // query covers the full "everyone" set; no playerGuardians union needed.
  const allRows = await db
    .select({
      userId: adultUsers.id,
      email: adultUsers.email,
      phone: adultUsers.phone,
      textOptIn: adultUsers.textOptIn,
    })
    .from(teamMemberships)
    .innerJoin(adultUsers, eq(teamMemberships.userId, adultUsers.id))
    .where(eq(teamMemberships.teamId, teamId));

  return dedupeRecipients(allRows);
}

export type TeamRecipient = {
  userId: string;
  email: string;
  phone: string | null;
  textOptIn: boolean;
};

function dedupeRecipients(rows: TeamRecipient[]) {
  return Array.from(
    new Map(rows.map((row) => [row.email, row])).values(),
  );
}

export async function listEventUpdateRecipients(
  teamId: string,
  eventId: string,
  mode:
    | "ALL_GUARDIANS"
    | "RESPONDED_PLAYERS"
    | "NON_RESPONDERS"
    | "STAFF"
    | "EVERYONE",
) {
  if (mode === "ALL_GUARDIANS") {
    return listTeamRecipients(teamId, "GUARDIANS");
  }

  if (mode === "STAFF") {
    return listTeamRecipients(teamId, "STAFF");
  }

  if (mode === "EVERYONE") {
    return listTeamRecipients(teamId, "ALL");
  }

  // RESPONDED_PLAYERS and NON_RESPONDERS both need the set of players
  // who have an RSVP for this event. RESPONDED_PLAYERS filters the
  // roster to that set; NON_RESPONDERS filters to its complement.
  const respondedPlayerRows = await db
    .select({
      playerId: playerEventResponses.playerId,
    })
    .from(playerEventResponses)
    .where(eq(playerEventResponses.eventId, eventId));

  const respondedIds = new Set(respondedPlayerRows.map((row) => row.playerId));

  if (mode === "RESPONDED_PLAYERS") {
    if (respondedIds.size === 0) return [];
    const guardianRows = await db
      .select({
        userId: adultUsers.id,
        email: adultUsers.email,
        phone: adultUsers.phone,
        textOptIn: adultUsers.textOptIn,
        playerId: playerGuardians.playerId,
      })
      .from(playerGuardians)
      .innerJoin(adultUsers, eq(playerGuardians.userId, adultUsers.id))
      .innerJoin(players, eq(playerGuardians.playerId, players.id))
      .where(
        and(
          eq(players.teamId, teamId),
          inArray(playerGuardians.playerId, Array.from(respondedIds)),
        ),
      );

    return Array.from(
      new Map(guardianRows.map((row) => [row.email, row])).values(),
    );
  }

  // mode === "NON_RESPONDERS"
  const nonResponderGuardianRows = await db
    .select({
      userId: adultUsers.id,
      email: adultUsers.email,
      phone: adultUsers.phone,
      textOptIn: adultUsers.textOptIn,
      playerId: playerGuardians.playerId,
    })
    .from(playerGuardians)
    .innerJoin(adultUsers, eq(playerGuardians.userId, adultUsers.id))
    .innerJoin(players, eq(playerGuardians.playerId, players.id))
    .where(eq(players.teamId, teamId));

  const filtered = nonResponderGuardianRows.filter(
    (row) => !respondedIds.has(row.playerId),
  );

  return Array.from(
    new Map(filtered.map((row) => [row.email, row])).values(),
  );
}

// Cron runs frequently. We remind guardians once an event is within the next
// 48 hours. The reminder_deliveries unique index (event_id, user_id,
// reminder_type) keeps this safe against re-runs and lets later sweeps catch
// up if Railway misses an earlier tick.
export async function getPendingReminderEvents(now = new Date()) {
  const windowEnd = addHours(now, 48);

  return db.query.events.findMany({
    where: and(
      eq(events.status, "SCHEDULED"),
      gte(events.startsAt, now),
      lt(events.startsAt, windowEnd),
    ),
    orderBy: [asc(events.startsAt)],
  });
}

export async function getNonResponderGuardiansForEvent(eventId: string, teamId: string) {
  const [teamPlayerRows, responseRows, guardianRows, priorDeliveries] =
    await Promise.all([
      db.query.players.findMany({
        where: eq(players.teamId, teamId),
      }),
      db.query.playerEventResponses.findMany({
        where: eq(playerEventResponses.eventId, eventId),
      }),
      db
        .select({
          userId: adultUsers.id,
          email: adultUsers.email,
          name: adultUsers.name,
          reminderOptIn: adultUsers.reminderOptIn,
          phone: adultUsers.phone,
          textOptIn: adultUsers.textOptIn,
          playerId: playerGuardians.playerId,
          playerFirstName: players.firstName,
          playerLastName: players.lastName,
          preferredName: players.preferredName,
        })
        .from(playerGuardians)
        .innerJoin(adultUsers, eq(playerGuardians.userId, adultUsers.id))
        .innerJoin(players, eq(playerGuardians.playerId, players.id))
        .where(eq(players.teamId, teamId)),
      db.query.reminderDeliveries.findMany({
        where: eq(reminderDeliveries.eventId, eventId),
      }),
    ]);

  const respondedPlayerIds = new Set(responseRows.map((row) => row.playerId));
  const alreadyRemindedUserIds = new Set(
    priorDeliveries.map((row) => row.userId),
  );
  const activePlayerIds = new Set(teamPlayerRows.map((row) => row.id));

  const grouped = new Map<
    string,
    {
      userId: string;
      email: string;
      name: string | null;
      phone: string | null;
      textOptIn: boolean;
      players: string[];
    }
  >();

  for (const row of guardianRows) {
    if (!row.reminderOptIn) continue;
    if (!activePlayerIds.has(row.playerId)) continue;
    if (respondedPlayerIds.has(row.playerId)) continue;
    if (alreadyRemindedUserIds.has(row.userId)) continue;

    const existing = grouped.get(row.userId);
    const playerName = fullName(
      row.playerFirstName,
      row.playerLastName,
      row.preferredName,
    );

    if (existing) {
      existing.players.push(playerName);
      continue;
    }

    grouped.set(row.userId, {
      userId: row.userId,
      email: row.email,
      name: row.name,
      phone: row.phone,
      textOptIn: row.textOptIn,
      players: [playerName],
    });
  }

  return Array.from(grouped.values());
}
