/**
 * One-off: send the RSVP-variant event email to a hand-picked set of
 * recipients, bypassing the audience filter on /events/[id]/email.
 *
 * What it does, in order:
 *   1. Looks up the event + recipients in adult_users.
 *   2. Optionally links an operator user to a test player if both
 *      TEST_RSVP_OPERATOR_EMAIL and TEST_RSVP_PLAYER_ID are provided.
 *      This row persists past the script run, so cleanup SQL is printed.
 *   3. Prints a summary and asks for y/n confirmation.
 *   4. Sends via sendTeamEmail with renderEventRsvpEmail for guardians.
 *
 * Usage:
 *   TEST_RSVP_RECIPIENTS="parent@example.com,coach@example.com" \
 *   railway run -- pnpm tsx src/scripts/send-test-rsvp.ts <eventId>
 *
 * Optional temp-link env:
 *   TEST_RSVP_OPERATOR_EMAIL="parent@example.com"
 *   TEST_RSVP_PLAYER_ID="<player uuid>"
 */

import { createInterface } from "node:readline/promises";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { adultUsers, events, playerGuardians, players } from "@/db/schema";
import { renderEventRsvpEmail } from "@/lib/email-templates";
import { sendTeamEmail } from "@/lib/notifications";
import { normalizeEmail } from "@/lib/utils";

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} (y/N) `)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const eventId = process.argv[2];
  if (!eventId) {
    throw new Error("Usage: tsx src/scripts/send-test-rsvp.ts <eventId>");
  }

  const recipientEmails = parseCsv(process.env.TEST_RSVP_RECIPIENTS);
  const operatorEmail = process.env.TEST_RSVP_OPERATOR_EMAIL
    ? normalizeEmail(process.env.TEST_RSVP_OPERATOR_EMAIL)
    : null;
  const operatorTestPlayerId = process.env.TEST_RSVP_PLAYER_ID?.trim() || null;

  if (recipientEmails.length === 0) {
    throw new Error(
      "TEST_RSVP_RECIPIENTS is empty. Set it to a comma-separated email list.",
    );
  }

  if (Boolean(operatorEmail) !== Boolean(operatorTestPlayerId)) {
    throw new Error(
      "Set both TEST_RSVP_OPERATOR_EMAIL and TEST_RSVP_PLAYER_ID, or neither.",
    );
  }

  const normalized = recipientEmails.map(normalizeEmail);

  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new Error(`No event with id ${eventId}`);

  const users = await db
    .select({
      id: adultUsers.id,
      email: adultUsers.email,
      name: adultUsers.name,
    })
    .from(adultUsers)
    .where(inArray(adultUsers.email, normalized));

  const missing = normalized.filter(
    (email) => !users.some((u) => u.email === email),
  );
  if (missing.length > 0) {
    throw new Error(`No adult_users row for: ${missing.join(", ")}`);
  }

  // --- step 2: optionally link operator to test player (idempotent) --------

  let operator:
    | {
        id: string;
        email: string;
        name: string | null;
      }
    | null = null;
  let testPlayer: { id: string; teamId: string; firstName: string } | null =
    null;

  if (operatorEmail && operatorTestPlayerId) {
    operator = users.find((u) => u.email === operatorEmail) ?? null;
    if (!operator) {
      throw new Error(
        `TEST_RSVP_OPERATOR_EMAIL (${operatorEmail}) is not in TEST_RSVP_RECIPIENTS`,
      );
    }

    const [player] = await db
      .select({
        id: players.id,
        teamId: players.teamId,
        firstName: players.firstName,
      })
      .from(players)
      .where(eq(players.id, operatorTestPlayerId));
    if (!player) {
      throw new Error(`No player with id ${operatorTestPlayerId}`);
    }
    if (player.teamId !== event.teamId) {
      throw new Error(
        `Test player ${player.firstName} is on team ${player.teamId}, ` +
          `but event is for team ${event.teamId}. They must match.`,
      );
    }

    await db
      .insert(playerGuardians)
      .values({
        playerId: operatorTestPlayerId,
        userId: operator.id,
        relationshipLabel: "Test link - see send-test-rsvp.ts",
      })
      .onConflictDoNothing();

    testPlayer = player;
  }

  // --- step 3: identify which recipients are now guardians -----------------

  const teamPlayerIds = (
    await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.teamId, event.teamId))
  ).map((p) => p.id);

  const guardianRows = await db
    .select({ userId: playerGuardians.userId })
    .from(playerGuardians)
    .where(inArray(playerGuardians.playerId, teamPlayerIds));
  const guardianUserIds = new Set(guardianRows.map((r) => r.userId));

  const recipients = users.map((u) => ({
    email: u.email,
    userId: u.id,
    firstName: u.name?.split(/\s+/)[0] ?? "there",
    isGuardian: guardianUserIds.has(u.id),
  }));

  // --- step 3.5: summary + confirm -----------------------------------------

  console.log(`\nEvent: ${event.title}  (${event.id})`);
  if (operator && testPlayer) {
    console.log(
      `Temp test link: ${operator.email} -> ${testPlayer.firstName} (${testPlayer.id})\n`,
    );
  } else {
    console.log("Temp test link: none\n");
  }
  console.log("Recipients:");
  for (const r of recipients) {
    const tag = r.isGuardian ? "RSVP CTA" : "PLAIN BODY (not a guardian)";
    console.log(`  ${r.email.padEnd(36)} ${r.firstName.padEnd(12)} ${tag}`);
  }
  console.log("");

  const ok = await confirm("Send these emails via Resend?");
  if (!ok) {
    console.log("Aborted.");
    if (operator && operatorTestPlayerId) {
      printCleanup(operator.id, operatorTestPlayerId);
    }
    return;
  }

  // --- step 4: send --------------------------------------------------------

  await sendTeamEmail({
    teamId: event.teamId,
    eventId: event.id,
    kind: "BROADCAST",
    subject: `[TEST] ${event.title}`,
    body: `[TEST SEND - please ignore or reply with feedback]\n\nThis is a preview of the RSVP email guardians will receive for ${event.title}.`,
    recipients: recipients.map((r) => ({ email: r.email, userId: r.userId })),
    metadata: { test: true, source: "send-test-rsvp.ts" },
    renderBody: (recipient) => {
      const match = recipients.find((r) => r.email === recipient.email);
      if (!match || !match.isGuardian) return {};
      return renderEventRsvpEmail({
        event,
        guardianId: match.userId,
        guardianFirstName: match.firstName,
        subjectPrefix: "[TEST]",
        bodyIntro: `This is a preview of the RSVP email for **${event.title}**. The buttons below are real - feel free to click one to test.`,
      });
    },
  });

  console.log("\nSent.");
  if (operator && operatorTestPlayerId) {
    printCleanup(operator.id, operatorTestPlayerId);
  }
}

function printCleanup(operatorUserId: string, operatorTestPlayerId: string) {
  console.log("\n--- cleanup (run after you've tested the click flow) ---");
  console.log(`-- 1. unlink operator from test player`);
  console.log(`delete from player_guardians`);
  console.log(`where player_id = '${operatorTestPlayerId}'`);
  console.log(`  and user_id   = '${operatorUserId}';`);
  console.log("");
  console.log(`-- 2. (optional) delete operator's test RSVP responses`);
  console.log(`delete from player_event_responses`);
  console.log(`where responded_by_user_id = '${operatorUserId}';`);
  console.log("---------------------------------------------------------");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
