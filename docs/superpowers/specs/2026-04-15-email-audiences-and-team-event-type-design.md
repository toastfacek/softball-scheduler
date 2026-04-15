# Email audience expansion + Team event type — Design

## Goal

Two small, orthogonal additions to the event management flow:

1. **Expand the event-email audience picker** so coaches/admins can message staff directly, blast the whole team, or nudge specific non-responders — not just guardians.
2. **Add a third event type (`TEAM_EVENT`, labeled "Team event")** for non-game, non-practice calendar items like Picture Day, Opening Day, banquets, and end-of-season parties.

Both ship together because they touch adjacent surfaces (event detail, event form, email page) and both are enum-level extensions with minimal blast radius.

## Scope

### In

- Three new values in the email audience enum: `NON_RESPONDERS`, `STAFF`, `EVERYONE`.
- Wiring in the email page `<select>`, the Zod validator, and the recipient-resolver in `src/lib/data.ts`.
- New `TEAM_EVENT` value in the `event_type` Postgres enum.
- A `src/lib/event-display.ts` helper that maps event types to labels and chip classes (replaces binary `type === "GAME" ? "Game" : "Practice"` ternaries).
- New `chip--team-event` CSS class (gold/amber) in `src/app/globals.css`.
- Drizzle migration: `ALTER TYPE "event_type" ADD VALUE 'TEAM_EVENT';` (non-destructive, no backfill).
- Seed data: one sample `TEAM_EVENT` ("Picture Day") in `src/scripts/seed.ts`.

### Out

- Separate notification templates per audience (they all use the existing `sendTeamEmail` rendering path).
- Idempotency key for manual non-responder sends — manual sends trust the admin; only the 24h cron uses `reminder_deliveries` for dedupe.
- Game-only features extending to `TEAM_EVENT` (lineups stay game-only).
- Editing existing events' types after creation gets no special treatment; the form already supports `type` edits.
- New email UI design or templating changes.

## Non-goals (explicit)

- The non-responder audience is **not** a replacement for the automated 24h cron in `src/lib/reminders.ts`. It's a manual coach-initiated send, separate from and unaware of `reminder_deliveries` state. A guardian may get both a cron nudge and a manual nudge — that's acceptable.
- `TEAM_EVENT` does **not** get a lineup. Lineups remain game-only. Existing gates on `type === "GAME"` in `src/lib/data.ts` and `src/actions/lineup-actions.ts` are sufficient — no new exclusion logic needed.

## User flows

### Flow 1 — Emailing coaches & admins about an event

1. Admin opens `/events/{eventId}/email`.
2. In the **Recipients** dropdown, selects "Coaches & admins".
3. Writes subject + body, submits.
4. `sendTeamEmail` dispatches to all `team_memberships` rows with role `COACH` or `ADMIN` on the viewer's team — same set already returned by `listTeamRecipients(teamId, "STAFF")`.
5. `email_messages.metadata.audience = "STAFF"` is recorded for audit.

### Flow 2 — Nudging non-responders manually

1. Admin opens `/events/{eventId}/email`.
2. Selects "Guardians of non-responders".
3. Recipients resolve to: guardians of players on the current season roster who have **no** `player_event_responses` row for this event.
4. Send goes out through `sendTeamEmail` with `metadata.audience = "NON_RESPONDERS"`.
5. No `reminder_deliveries` row is written — this path is manual and outside the cron's idempotency tracking.

### Flow 3 — Creating a Team Event

1. Coach/admin opens `/events/new` (or equivalent event-creation entry).
2. In the **Type** dropdown, picks "Team event" alongside existing "Practice" and "Game".
3. Default end time populates via `defaultEndFor()` — 2 hours after start, same as practice.
4. On save, event is persisted with `type = "TEAM_EVENT"`.
5. Event appears in schedule, calendar, and detail views with a gold chip labeled "Team event".
6. RSVPs work identically to practice (per-player, guardians respond).
7. 24h non-responder cron picks it up automatically — no type filter in `src/lib/reminders.ts`.
8. Lineup pages do not appear (existing `type === "GAME"` gate already excludes it).

## Architecture

### Part 1 — Email audience expansion

**Single dispatcher extension.** All audience logic lives in one function: `listEventUpdateRecipients(teamId, eventId, mode)` in [src/lib/data.ts:822](src/lib/data.ts#L822). The function becomes a five-branch switch:

| Audience enum      | UI label                              | Implementation                                                  |
| ------------------ | ------------------------------------- | --------------------------------------------------------------- |
| `ALL_GUARDIANS`    | All guardians                         | Existing — `listTeamRecipients(teamId, "GUARDIANS")`            |
| `RESPONDED_PLAYERS`| Guardians of players who responded    | Existing query                                                  |
| `NON_RESPONDERS`   | Guardians of players who haven't responded | New query: roster players with no `player_event_responses` row for this event, then resolve guardians |
| `STAFF`            | Coaches & admins                      | New — `listTeamRecipients(teamId, "STAFF")` (already exists)    |
| `EVERYONE`         | Everyone (guardians + staff)          | New — `listTeamRecipients(teamId, "ALL")` (already exists)      |

**Zod enum** at [src/actions/event-actions.ts:69](src/actions/event-actions.ts#L69) extends to all 5 values. The existing `sendEventUpdateAction` body does not need other changes — the audience is passed straight through to the dispatcher and recorded on `email_messages.metadata`.

**Form update** at [src/app/(app)/events/[eventId]/email/page.tsx:35-40](src/app/(app)/events/[eventId]/email/page.tsx#L35-L40): three new `<option>` elements.

### Part 2 — `TEAM_EVENT` event type

**Schema** ([src/db/schema.ts:29](src/db/schema.ts#L29)):
```ts
export const eventTypeEnum = pgEnum("event_type", ["GAME", "PRACTICE", "TEAM_EVENT"]);
```

**Migration:** `pnpm db:generate` produces a single `ALTER TYPE` migration. No data backfill required; existing rows keep their current type.

**New display helper** (`src/lib/event-display.ts`, new file):
```ts
import type { EventType } from "@/db/schema";

export function eventTypeLabel(type: EventType): string {
  switch (type) {
    case "GAME": return "Game";
    case "PRACTICE": return "Practice";
    case "TEAM_EVENT": return "Team event";
  }
}

export function eventTypeChipClass(type: EventType): string {
  switch (type) {
    case "GAME": return "chip--game";
    case "PRACTICE": return "chip--practice";
    case "TEAM_EVENT": return "chip--team-event";
  }
}
```

TypeScript exhaustiveness on the union ensures adding a fourth type in the future surfaces a compile error at every switch — the helper is the single point of maintenance for type-to-label and type-to-chip mappings.

**Chip CSS** — add `chip--team-event` next to the existing chip classes in [src/app/globals.css](src/app/globals.css). Gold/amber accent, styled to sit visually between `chip--practice` (green) and `chip--game` (orange).

**Callsites to migrate** to the new helper:

| File | Current | After |
| --- | --- | --- |
| [src/app/(app)/events/[eventId]/page.tsx:64](src/app/(app)/events/[eventId]/page.tsx#L64) | binary ternary → `chip--game`/`chip--practice` | `eventTypeChipClass(type)` |
| [src/app/(app)/events/[eventId]/attendance/page.tsx:75](src/app/(app)/events/[eventId]/attendance/page.tsx#L75) | same binary ternary | `eventTypeChipClass(type)` |
| [src/app/(app)/schedule/page.tsx:95](src/app/(app)/schedule/page.tsx#L95) | buggy: `type === "GAME" ? "Game" : "Practice"` | `eventTypeLabel(type)` — fixes the existing fall-through |
| [src/components/schedule-calendar.tsx:185](src/components/schedule-calendar.tsx#L185) | binary ternary for color | `eventTypeChipClass(type)` |
| [src/components/event-card.tsx:13](src/components/event-card.tsx#L13) | widen inline type | Import `EventType` from schema |

**Event form** ([src/components/event-form-fields.tsx:31-34](src/components/event-form-fields.tsx#L31-L34)): add `<option value="TEAM_EVENT">Team event</option>`.

**Action Zod validator** ([src/actions/event-actions.ts:29](src/actions/event-actions.ts#L29)): extend enum.

**Default duration** ([src/actions/event-actions.ts:44](src/actions/event-actions.ts#L44)): `defaultEndFor()` gains a `TEAM_EVENT` case returning `startsAt + 2h` (same as practice).

**No changes needed** in:
- [src/lib/reminders.ts](src/lib/reminders.ts) — cron doesn't filter by type.
- [src/lib/data.ts:514,544](src/lib/data.ts#L514) (game queries) and [src/actions/lineup-actions.ts:46](src/actions/lineup-actions.ts#L46) (lineup gate) — the existing `eq(events.type, "GAME")` checks automatically exclude `TEAM_EVENT`.
- RSVP logic — `player_event_responses` is type-agnostic.

**Seed** ([src/scripts/seed.ts](src/scripts/seed.ts)): append one `TEAM_EVENT` row (e.g., "Picture Day") so local dev sees the new type rendered end-to-end.

## Data model

No new tables. No new columns. Two enum extensions:

1. `event_type` gains `TEAM_EVENT`.
2. The Zod audience enum in `event-actions.ts` gains `NON_RESPONDERS`, `STAFF`, `EVERYONE`. (Note: audience is validation-only, not a Postgres enum — it lives in TypeScript + `email_messages.metadata.audience` as a free-form string.)

## Error handling

- **Invalid audience** → Zod parse failure → server action throws before any email send. Existing behavior.
- **Empty non-responder set** (everyone's already RSVP'd) → the action should short-circuit before calling `sendTeamEmail` and surface a "no recipients" message to the admin. Implementation detail for the plan: check recipient list length after `listEventUpdateRecipients` returns and return early with a user-visible flash. Avoids writing an `email_messages` row for a send that never happened.
- **TEAM_EVENT without a lineup** is correct behavior, not an error. Lineup pages just won't link from the event.
- **Backward compatibility:** existing events, email metadata, and recipient queries are unaffected by the enum extensions.

## Testing / verification

No test runner is configured (per [AGENTS.md](AGENTS.md)). Verification bar:

1. `pnpm db:generate` — produces exactly one migration file (the `ALTER TYPE`).
2. `pnpm db:migrate` — applies cleanly against a local Postgres.
3. `pnpm typecheck && pnpm lint` — pass. The new exhaustive `switch` in `event-display.ts` will catch any missed callsite.
4. `pnpm db:seed` — new `TEAM_EVENT` seed row renders end-to-end.
5. **Manual smoke test:**
   - Create a Team Event via the form. Verify gold chip, correct label, no lineup link.
   - RSVP as a guardian. Verify the 24h cron (can be triggered manually via `pnpm cron:reminders`) picks it up if within the window.
   - Open the email page on any event. For each of the 5 audience options, send a test message and verify the `email_recipients` rows match the expected set by querying `email_messages.metadata->>'audience'` in `pnpm db:studio`.

## Rollout

- Single PR covering both features. Drizzle migration is applied via `pnpm db:migrate` against Railway Postgres as part of the deploy procedure.
- No feature flag. Both additions are additive and backward-compatible.
- No data migration. Existing events keep their types; existing email history keeps its audience values.
