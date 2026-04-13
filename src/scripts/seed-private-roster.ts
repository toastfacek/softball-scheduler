import fs from "node:fs";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import XLSX from "xlsx";

import { db } from "../db";
import {
  adultUsers,
  playerGuardians,
  players,
  seasons,
  teamMemberships,
  teamPositionTemplates,
  teams,
} from "../db/schema";
import { DEFAULT_TEAM_COLORS, DEFAULT_TEAM_POSITIONS } from "../lib/constants";
import { normalizeEmail, slugify } from "../lib/utils";

type SheetRow = Record<string, unknown>;

type GuardianSeed = {
  name: string | null;
  email: string;
  phone: string | null;
  relationshipLabel: string;
};

const config = {
  teamName: process.env.SEED_TEAM_NAME ?? "Beverly Orange",
  teamSlug: process.env.SEED_TEAM_SLUG ?? "beverly-orange",
  brandSubtitle:
    process.env.SEED_TEAM_BRAND_SUBTITLE ?? "Middle School Juniors Spring 2026",
  seasonName:
    process.env.SEED_SEASON_NAME ?? "Middle School Juniors Spring 2026",
  seasonYear: Number(process.env.SEED_SEASON_YEAR ?? "2026"),
  rosterSheetName: process.env.ROSTER_SHEET_NAME ?? "Roster",
  adminEmail: normalizeOptionalEmail(process.env.SEED_ADMIN_EMAIL),
  adminName: optionalText(process.env.SEED_ADMIN_NAME),
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const normalized = text(value);
  return normalized || null;
}

function normalizeOptionalEmail(value: unknown) {
  const normalized = optionalText(value);
  return normalized ? normalizeEmail(normalized) : null;
}

function buildName(firstName: unknown, lastName: unknown) {
  const first = optionalText(firstName);
  const last = optionalText(lastName);

  if (first && last) {
    const firstLower = first.toLowerCase();
    const lastLower = last.toLowerCase();

    if (firstLower === lastLower || firstLower.endsWith(` ${lastLower}`)) {
      return first;
    }

    return `${first} ${last}`;
  }

  return first ?? last ?? null;
}

function notesFromRow(row: SheetRow) {
  const details = [
    optionalText(row["Grade"]) ? `Grade: ${optionalText(row["Grade"])}` : null,
    optionalText(row["P? C?"])
      ? `Registration notes: ${optionalText(row["P? C?"])}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return details.length > 0 ? details.join(" | ") : null;
}

function resolveWorkbookPath() {
  const configured = optionalText(process.env.ROSTER_XLSX_PATH);
  if (configured) {
    return path.resolve(configured);
  }

  const docsDir = path.resolve(process.cwd(), "docs");
  const xlsxFiles = fs.existsSync(docsDir)
    ? fs
        .readdirSync(docsDir)
        .filter((entry) => entry.toLowerCase().endsWith(".xlsx"))
    : [];

  if (xlsxFiles.length === 1) {
    return path.join(docsDir, xlsxFiles[0]);
  }

  if (xlsxFiles.length === 0) {
    throw new Error(
      "No roster workbook found. Set ROSTER_XLSX_PATH to your private .xlsx file.",
    );
  }

  throw new Error(
    "Found multiple .xlsx files under docs/. Set ROSTER_XLSX_PATH to choose one.",
  );
}

function parseGuardians(row: SheetRow) {
  const rawGuardians: Array<GuardianSeed | null> = [
    {
      name: buildName(
        row["Parent/Guardian 1 FName"],
        row["Parent/Guardian 1 LName"],
      ),
      email: normalizeOptionalEmail(row["Parent 1 Email Address"]) ?? "",
      phone: optionalText(row["Parent 1 Phone Number"]),
      relationshipLabel: "Parent",
    },
    {
      name: buildName(
        row["Parent/Guardian 2 FName"],
        row["Parent/Guardian 2 LName"],
      ),
      email: normalizeOptionalEmail(row["Parent 2 Email Address"]) ?? "",
      phone: optionalText(row["Parent 2 Phone Number"]),
      relationshipLabel: "Parent",
    },
  ];

  const deduped = new Map<string, GuardianSeed>();
  for (const guardian of rawGuardians) {
    if (!guardian?.email) continue;
    if (deduped.has(guardian.email)) continue;
    deduped.set(guardian.email, guardian);
  }

  return Array.from(deduped.values());
}

async function ensureAdult(input: {
  name: string | null;
  email: string;
  phone: string | null;
}) {
  const email = normalizeEmail(input.email);
  const existing = await db.query.adultUsers.findFirst({
    where: eq(adultUsers.email, email),
  });

  if (existing) {
    await db
      .update(adultUsers)
      .set({
        name: existing.name ?? input.name,
        phone: existing.phone ?? input.phone,
        updatedAt: new Date(),
      })
      .where(eq(adultUsers.id, existing.id));

    return existing.id;
  }

  const [created] = await db
    .insert(adultUsers)
    .values({
      name: input.name,
      email,
      phone: input.phone,
    })
    .returning();

  return created.id;
}

async function ensureMembership(
  userId: string,
  teamId: string,
  role: "PARENT" | "COACH" | "ADMIN",
  title: string | null = null,
) {
  const existing = await db.query.teamMemberships.findFirst({
    where: and(
      eq(teamMemberships.userId, userId),
      eq(teamMemberships.teamId, teamId),
      eq(teamMemberships.role, role),
    ),
  });

  if (existing) {
    const nextTitle = title ?? existing.title ?? null;
    if ((existing.title ?? null) !== nextTitle) {
      await db
        .update(teamMemberships)
        .set({
          title: nextTitle,
          updatedAt: new Date(),
        })
        .where(eq(teamMemberships.id, existing.id));
    }
    return;
  }

  await db.insert(teamMemberships).values({
    userId,
    teamId,
    role,
    title,
  });
}

async function ensureGuardianLink(input: {
  playerId: string;
  userId: string;
  relationshipLabel: string;
  sortOrder: number;
}) {
  const existing = await db.query.playerGuardians.findFirst({
    where: and(
      eq(playerGuardians.playerId, input.playerId),
      eq(playerGuardians.userId, input.userId),
    ),
  });

  if (existing) {
    await db
      .update(playerGuardians)
      .set({
        relationshipLabel: input.relationshipLabel,
        sortOrder: input.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(playerGuardians.id, existing.id));
    return;
  }

  await db.insert(playerGuardians).values(input);
}

async function ensureTeamAndSeason() {
  let team = await db.query.teams.findFirst({
    where: eq(teams.slug, slugify(config.teamSlug)),
  });

  if (!team) {
    [team] = await db
      .insert(teams)
      .values({
        name: config.teamName,
        brandSubtitle: config.brandSubtitle,
        slug: slugify(config.teamSlug),
        city: "Beverly",
        state: "MA",
        timezone: "America/New_York",
        primaryColor: DEFAULT_TEAM_COLORS.primary,
        secondaryColor: DEFAULT_TEAM_COLORS.secondary,
        accentColor: DEFAULT_TEAM_COLORS.accent,
      })
      .returning();
  } else {
    [team] = await db
      .update(teams)
      .set({
        name: config.teamName,
        brandSubtitle: config.brandSubtitle,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id))
      .returning();
  }

  let season = await db.query.seasons.findFirst({
    where: and(
      eq(seasons.teamId, team.id),
      eq(seasons.name, config.seasonName),
      eq(seasons.year, config.seasonYear),
    ),
  });

  if (!season) {
    [season] = await db
      .insert(seasons)
      .values({
        teamId: team.id,
        name: config.seasonName,
        year: config.seasonYear,
        isActive: true,
      })
      .returning();
  }

  return { team, season };
}

async function ensureDefaultPositions(teamId: string) {
  const existing = await db.query.teamPositionTemplates.findMany({
    where: eq(teamPositionTemplates.teamId, teamId),
  });
  const existingCodes = new Set(existing.map((row) => row.code));

  const missing = DEFAULT_TEAM_POSITIONS.filter(
    (position) => !existingCodes.has(position.code),
  );

  if (missing.length > 0) {
    await db.insert(teamPositionTemplates).values(
      missing.map((position) => ({
        teamId,
        ...position,
        isActive: true,
      })),
    );
  }
}

async function ensurePlayer(input: {
  teamId: string;
  seasonId: string;
  firstName: string;
  lastName: string;
  notes: string | null;
}) {
  const existing = await db.query.players.findFirst({
    where: and(
      eq(players.teamId, input.teamId),
      eq(players.firstName, input.firstName),
      eq(players.lastName, input.lastName),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(players)
      .set({
        seasonId: existing.seasonId ?? input.seasonId,
        notes: existing.notes ?? input.notes,
        updatedAt: new Date(),
      })
      .where(eq(players.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(players)
    .values({
      teamId: input.teamId,
      seasonId: input.seasonId,
      firstName: input.firstName,
      lastName: input.lastName,
      notes: input.notes,
    })
    .returning();

  return created;
}

async function main() {
  if (!Number.isInteger(config.seasonYear)) {
    throw new Error("SEED_SEASON_YEAR must be a whole number like 2026.");
  }

  if (!config.adminEmail) {
    throw new Error("Set SEED_ADMIN_EMAIL so prod has at least one admin login.");
  }

  const workbookPath = resolveWorkbookPath();
  const workbook = XLSX.readFile(workbookPath);
  const sheet = workbook.Sheets[config.rosterSheetName];

  if (!sheet) {
    throw new Error(
      `Sheet "${config.rosterSheetName}" not found in ${path.basename(workbookPath)}.`,
    );
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });
  const rosterRows = rows.filter((row) => {
    return Boolean(
      optionalText(row["Athlete First Name"]) &&
        optionalText(row["Athlete Last Name"]),
    );
  });

  const { team, season } = await ensureTeamAndSeason();
  await ensureDefaultPositions(team.id);

  let seededPlayers = 0;
  let seededGuardians = 0;
  let seededCoaches = 0;

  for (const row of rosterRows) {
    const registrationStatus = optionalText(row["Registration Status"]);
    if (registrationStatus && registrationStatus !== "Complete") {
      continue;
    }

    const player = await ensurePlayer({
      teamId: team.id,
      seasonId: season.id,
      firstName: text(row["Athlete First Name"]),
      lastName: text(row["Athlete Last Name"]),
      notes: notesFromRow(row),
    });
    seededPlayers += 1;

    const guardians = parseGuardians(row);
    for (const [index, guardian] of guardians.entries()) {
      const userId = await ensureAdult({
        name: guardian.name,
        email: guardian.email,
        phone: guardian.phone,
      });
      await ensureMembership(userId, team.id, "PARENT");
      await ensureGuardianLink({
        playerId: player.id,
        userId,
        relationshipLabel: guardian.relationshipLabel,
        sortOrder: index,
      });
      seededGuardians += 1;
    }

    const coachMarker = optionalText(row["Coach"]);
    if (coachMarker && guardians[0]) {
      const coachUser = await db.query.adultUsers.findFirst({
        where: eq(adultUsers.email, guardians[0].email),
      });
      if (coachUser) {
        await ensureMembership(
          coachUser.id,
          team.id,
          "COACH",
          coachMarker.toLowerCase() === "head coach" ? "Head Coach" : null,
        );
        seededCoaches += 1;
      }
    }
  }

  const adminUserId = await ensureAdult({
    name: config.adminName,
    email: config.adminEmail,
    phone: null,
  });
  await ensureMembership(adminUserId, team.id, "ADMIN");

  console.log("Roster seed complete.");
  console.log(`Workbook: ${path.basename(workbookPath)}`);
  console.log(`Team: ${team.name}`);
  console.log(`Season: ${season.name} (${season.year})`);
  console.log(`Players processed: ${seededPlayers}`);
  console.log(`Guardian links processed: ${seededGuardians}`);
  console.log(`Coach memberships processed: ${seededCoaches}`);
  console.log(`Admin login enabled for: ${config.adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
