# Email audience expansion + Team event type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new email audience options (non-responders, staff, everyone) and a new `TEAM_EVENT` event type (e.g., Picture Day) that behaves like a practice for RSVP/reminder purposes but has no lineup.

**Architecture:** Two orthogonal enum-level extensions. The email change threads one new audience enum and three new branches through `listEventUpdateRecipients`. The event-type change adds one Postgres enum value, a shared display helper (`src/lib/event-display.ts`), a new chip CSS class, and switches three hand-rolled type ternaries onto the existing `EventTypeChip` component.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM (postgres-js), Postgres enums, Tailwind v4 with CSS variables, Zod validators.

**Project verification bar:** No test runner is configured in this project (per [AGENTS.md](AGENTS.md)). Each task's verification is `pnpm typecheck && pnpm lint` and, where relevant, a targeted manual check. **No TDD steps** — test-first is not the workflow here.

---

## File Structure

**Create:**
- `src/lib/event-display.ts` — `eventTypeLabel(type)` + `eventTypeCalendarClass(type)`; single source of truth for display-side type mappings.
- `drizzle/NNNN_*.sql` — generated migration for the `event_type` enum extension.

**Modify:**
- `src/db/schema.ts` — add `TEAM_EVENT` to `eventTypeEnum`.
- `src/components/status-chip.tsx` — extend `eventStyles` map; render via `eventTypeLabel`.
- `src/components/event-card.tsx` — widen inline type union to `EventType`.
- `src/components/event-form-fields.tsx` — add `<option value="TEAM_EVENT">Team event</option>`.
- `src/components/schedule-calendar.tsx` — route calendar-cell class through helper.
- `src/actions/event-actions.ts` — extend `eventSchema.type` enum, extend `DEFAULT_DURATION_MIN` + `defaultEndFor`, extend `eventUpdateSchema.audience` enum, short-circuit on empty recipients.
- `src/lib/data.ts` — widen `listEventUpdateRecipients` mode union, add three new branches.
- `src/app/(app)/events/[eventId]/page.tsx` — replace hand-rolled chip with `<EventTypeChip>`.
- `src/app/(app)/events/[eventId]/attendance/page.tsx` — same.
- `src/app/(app)/events/[eventId]/email/page.tsx` — add three new `<option>` elements.
- `src/app/(app)/schedule/page.tsx` — replace `? "Game" : "Practice"` ternary with `eventTypeLabel()`.
- `src/app/globals.css` — add `.chip--team-event` and `.cal-event--team-event`.
- `src/scripts/seed.ts` — add one `TEAM_EVENT` sample row ("Picture Day").

---

## Tasks

### Task 1: Add `TEAM_EVENT` to the `event_type` Postgres enum

**Files:**
- Modify: `src/db/schema.ts:29`
- Create (generated): `drizzle/NNNN_*.sql`

- [ ] **Step 1: Edit the schema enum**

Change line 29 of [src/db/schema.ts](src/db/schema.ts):

```ts
export const eventTypeEnum = pgEnum("event_type", ["GAME", "PRACTICE", "TEAM_EVENT"]);
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file appears under `drizzle/` with something like `ALTER TYPE "public"."event_type" ADD VALUE 'TEAM_EVENT';`. No other statements should be present. If the migration includes unrelated changes, stop and investigate — you may have uncommitted drift.

- [ ] **Step 3: Apply the migration locally**

Run: `pnpm db:migrate`
Expected: migration applies without error. Confirm via `pnpm db:studio` that `event_type` now lists three values.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. Any `switch (type)` / `Record<EventType, ...>` sites without a `TEAM_EVENT` case will fail compilation — these are the sites Task 2 and Task 3 fix. If you see such errors now, that's expected; leave them for those tasks.

Actually — to avoid leaving the tree broken between commits, do **not** commit yet. Commit after Task 3 when the TypeScript errors introduced here are all cleared.

- [ ] **Step 5: (skip commit — continue)**

---

### Task 2: Create the event-display helper

**Files:**
- Create: `src/lib/event-display.ts`

- [ ] **Step 1: Write the helper**

Create `src/lib/event-display.ts` with exactly this content:

```ts
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
```

Both `switch` statements are intentionally exhaustive with no `default` — the TypeScript compiler will flag future additions to the `EventType` union, making this file the single maintenance point.

- [ ] **Step 2: Typecheck just this file**

Run: `pnpm typecheck`
Expected: this file compiles clean. Remaining errors from Task 1 at other sites are still expected until Task 3.

- [ ] **Step 3: (skip commit — continue)**

---

### Task 3: Fix `EventTypeChip` and hand-rolled chips for the new type

**Files:**
- Modify: `src/components/status-chip.tsx`
- Modify: `src/components/event-card.tsx:13`
- Modify: `src/app/(app)/events/[eventId]/page.tsx:60-68`
- Modify: `src/app/(app)/events/[eventId]/attendance/page.tsx:72-79`
- Modify: `src/app/globals.css` (append `.chip--team-event` + `.cal-event--team-event`)

- [ ] **Step 1: Update `EventTypeChip`**

In [src/components/status-chip.tsx](src/components/status-chip.tsx), make two edits.

Replace the `eventStyles` object (currently lines 13-18) with:

```ts
const eventStyles: Record<EventType, string> = {
  GAME:
    "border-[color-mix(in_srgb,var(--orange)_36%,white)] bg-[color-mix(in_srgb,var(--orange)_18%,white)] text-navy-strong",
  PRACTICE:
    "border-[color-mix(in_srgb,var(--navy)_16%,white)] bg-[color-mix(in_srgb,var(--navy)_8%,white)] text-navy",
  TEAM_EVENT:
    "border-[color-mix(in_srgb,var(--warning)_36%,white)] bg-[color-mix(in_srgb,var(--warning)_18%,white)] text-[color-mix(in_srgb,var(--warning)_74%,black)]",
};
```

Then replace the `EventTypeChip` function body (currently lines 62-73) with:

```tsx
import { eventTypeLabel } from "@/lib/event-display";

export function EventTypeChip({ type }: { type: EventType }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-[0.8rem] border px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.18em]",
        eventStyles[type],
      )}
    >
      {eventTypeLabel(type)}
    </span>
  );
}
```

Note: the existing `import { cn } from "@/lib/utils"` on line 1 stays. The new `import { eventTypeLabel } from "@/lib/event-display"` goes after line 2. `{type}` on line 70 becomes `{eventTypeLabel(type)}`. The `TEAM_EVENT` style uses the existing `--warning` CSS variable (gold/amber) — matches the spec's gold chip request and uses an already-defined token.

- [ ] **Step 2: Widen `EventCard`'s inline event type**

In [src/components/event-card.tsx:13](src/components/event-card.tsx#L13), change:

```ts
    type: "GAME" | "PRACTICE";
```

to:

```ts
    type: EventType;
```

Add to the existing import block at the top of the file:

```ts
import type { AttendanceStatus, EventType } from "@/db/schema";
```

(Replaces the existing `import type { AttendanceStatus } from "@/db/schema";` on line 7.)

- [ ] **Step 3: Migrate the event-detail chip to `EventTypeChip`**

In [src/app/(app)/events/[eventId]/page.tsx](src/app/(app)/events/[eventId]/page.tsx), replace the hand-rolled chip block at lines 62-68:

```tsx
          <span
            className={`chip ${
              data.event.type === "GAME" ? "chip--game" : "chip--practice"
            }`}
          >
            {data.event.type}
          </span>
```

with:

```tsx
          <EventTypeChip type={data.event.type} />
```

Add the import near the top of the file (next to other component imports):

```ts
import { EventTypeChip } from "@/components/status-chip";
```

- [ ] **Step 4: Migrate the attendance-page chip the same way**

In [src/app/(app)/events/[eventId]/attendance/page.tsx](src/app/(app)/events/[eventId]/attendance/page.tsx), replace lines 73-79:

```tsx
          <span
            className={`chip ${
              data.event.type === "GAME" ? "chip--game" : "chip--practice"
            }`}
          >
            {data.event.type}
          </span>
```

with:

```tsx
          <EventTypeChip type={data.event.type} />
```

Add the import:

```ts
import { EventTypeChip } from "@/components/status-chip";
```

- [ ] **Step 5: Add CSS classes (only for completeness — new chip sites use `EventTypeChip`, but `.chip--team-event` is added so any direct class consumers don't break)**

Append to [src/app/globals.css](src/app/globals.css) at the end of the chip section (directly after the `.chip--practice` block around lines 515-519):

```css
.chip--team-event {
  border-color: color-mix(in srgb, var(--warning) 36%, white);
  background: color-mix(in srgb, var(--warning) 22%, white);
  color: color-mix(in srgb, var(--warning) 78%, black);
}
```

Append to the calendar section (directly after the `.cal-event--practice` block around lines 1672-1675):

```css
.cal-event--team-event {
  background: color-mix(in srgb, var(--warning) 14%, var(--paper));
  border-left-color: color-mix(in srgb, var(--warning) 72%, black);
  color: color-mix(in srgb, var(--warning) 80%, black);
}
```

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. All Task 1 type errors should now be resolved.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts drizzle/ src/lib/event-display.ts src/components/status-chip.tsx src/components/event-card.tsx src/app/\(app\)/events/\[eventId\]/page.tsx src/app/\(app\)/events/\[eventId\]/attendance/page.tsx src/app/globals.css
git commit -m "$(cat <<'EOF'
Add TEAM_EVENT type with label + chip styling

Introduces TEAM_EVENT to the event_type enum, an eventTypeLabel /
eventTypeCalendarClass helper for exhaustive type-to-display mapping,
and consolidates two hand-rolled chip sites onto the shared
EventTypeChip component. New chip uses the --warning (gold) token.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire `TEAM_EVENT` through the event form + action

**Files:**
- Modify: `src/components/event-form-fields.tsx:31-34`
- Modify: `src/actions/event-actions.ts:29`
- Modify: `src/actions/event-actions.ts:43-46`

- [ ] **Step 1: Add the form option**

In [src/components/event-form-fields.tsx](src/components/event-form-fields.tsx), replace lines 31-34:

```tsx
        <select id="type" name="type" defaultValue={event?.type ?? "PRACTICE"}>
          <option value="PRACTICE">Practice</option>
          <option value="GAME">Game</option>
        </select>
```

with:

```tsx
        <select id="type" name="type" defaultValue={event?.type ?? "PRACTICE"}>
          <option value="PRACTICE">Practice</option>
          <option value="GAME">Game</option>
          <option value="TEAM_EVENT">Team event</option>
        </select>
```

- [ ] **Step 2: Extend the event Zod schema**

In [src/actions/event-actions.ts:29](src/actions/event-actions.ts#L29), change:

```ts
  type: z.enum(["GAME", "PRACTICE"]),
```

to:

```ts
  type: z.enum(["GAME", "PRACTICE", "TEAM_EVENT"]),
```

- [ ] **Step 3: Extend the default-duration map**

In [src/actions/event-actions.ts:43-46](src/actions/event-actions.ts#L43-L46), replace:

```ts
const DEFAULT_DURATION_MIN = { PRACTICE: 90, GAME: 120 } as const;
function defaultEndFor(startsAt: Date, type: "PRACTICE" | "GAME"): Date {
  return new Date(startsAt.getTime() + DEFAULT_DURATION_MIN[type] * 60 * 1000);
}
```

with:

```ts
const DEFAULT_DURATION_MIN = {
  PRACTICE: 90,
  GAME: 120,
  TEAM_EVENT: 120,
} as const;
function defaultEndFor(startsAt: Date, type: EventType): Date {
  return new Date(startsAt.getTime() + DEFAULT_DURATION_MIN[type] * 60 * 1000);
}
```

Add `EventType` to the existing type import at the top of the file:

```ts
import type { EventType } from "@/db/schema";
```

(If there's already a type-only import from `@/db/schema`, add `EventType` to it; otherwise add a new `import type` line.)

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/event-form-fields.tsx src/actions/event-actions.ts
git commit -m "$(cat <<'EOF'
Accept TEAM_EVENT in event form and action

Adds the "Team event" option to the event-type dropdown, extends the
Zod validator, and defaults TEAM_EVENT duration to 2 hours (matching
practice).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Update schedule and calendar views

**Files:**
- Modify: `src/app/(app)/schedule/page.tsx:95`
- Modify: `src/components/schedule-calendar.tsx:183-188`

- [ ] **Step 1: Fix schedule page label**

In [src/app/(app)/schedule/page.tsx:95](src/app/(app)/schedule/page.tsx#L95), replace:

```tsx
                        {event.type === "GAME" ? "Game" : "Practice"}
```

with:

```tsx
                        {eventTypeLabel(event.type)}
```

Add the import near the top of the file:

```ts
import { eventTypeLabel } from "@/lib/event-display";
```

- [ ] **Step 2: Fix calendar cell class**

In [src/components/schedule-calendar.tsx:183-188](src/components/schedule-calendar.tsx#L183-L188), replace:

```tsx
                      className={cn(
                        "cal-event",
                        event.type === "GAME"
                          ? "cal-event--game"
                          : "cal-event--practice",
                      )}
```

with:

```tsx
                      className={cn("cal-event", eventTypeCalendarClass(event.type))}
```

Add the import near the top of the file:

```ts
import { eventTypeCalendarClass } from "@/lib/event-display";
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/schedule/page.tsx src/components/schedule-calendar.tsx
git commit -m "$(cat <<'EOF'
Use event-display helpers for schedule + calendar

Replaces binary type ternaries with exhaustive helpers. Fixes a latent
bug where any non-GAME type (now TEAM_EVENT) would render as
"Practice" on the schedule list.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Seed a sample Team Event

**Files:**
- Modify: `src/scripts/seed.ts:210-242`

- [ ] **Step 1: Add Picture Day to the seed script**

In [src/scripts/seed.ts](src/scripts/seed.ts), locate the `await db.insert(events).values([...])` block starting around line 210. Before it, add another date:

```ts
    const pictureDayStart = new Date();
    pictureDayStart.setDate(pictureDayStart.getDate() + 10);
    pictureDayStart.setHours(10, 0, 0, 0);
```

(Place it alongside the existing `practiceStart` / `gameStart` declarations, around lines 202-208.)

Then append a third object to the `.values([...])` array (right after the game object, before `.returning()`):

```ts
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
```

Also update the destructuring on line 210 from `const [practice, game]` to:

```ts
    const [practice, game, _pictureDay] = await db
```

(The `_pictureDay` is unused downstream; the underscore prefix silences the unused-var lint.)

- [ ] **Step 2: Run the seed**

**Note:** `pnpm db:seed` resets local demo data. If you have local work you care about, skip this step and verify via `pnpm db:studio` after the fact.

Run: `pnpm db:seed`
Expected: completes without error; `pnpm db:studio` shows three events including one with `type = 'TEAM_EVENT'` titled "Picture Day".

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/seed.ts
git commit -m "$(cat <<'EOF'
Seed a sample Team Event (Picture Day)

So local dev sees the new TEAM_EVENT type rendered end-to-end in the
schedule, calendar, and event detail views.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Extend email audience enum and recipient resolver

**Files:**
- Modify: `src/actions/event-actions.ts:67-72`
- Modify: `src/lib/data.ts:822-866`

- [ ] **Step 1: Extend the audience Zod enum**

In [src/actions/event-actions.ts:69](src/actions/event-actions.ts#L69), change:

```ts
  audience: z.enum(["ALL_GUARDIANS", "RESPONDED_PLAYERS"]),
```

to:

```ts
  audience: z.enum([
    "ALL_GUARDIANS",
    "RESPONDED_PLAYERS",
    "NON_RESPONDERS",
    "STAFF",
    "EVERYONE",
  ]),
```

- [ ] **Step 2: Widen the `listEventUpdateRecipients` mode union and add branches**

In [src/lib/data.ts](src/lib/data.ts), replace the entire `listEventUpdateRecipients` function (currently lines 822-866) with:

```ts
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
```

Rationale for the `NON_RESPONDERS` implementation: we pull every guardian-player pair on the team, then filter out pairs whose player has already responded. A guardian is kept if **any** of their players lacks a response — which matches the intent ("nudge the family because at least one kid still owes you an RSVP"). Dedupe by email preserves the one-email-per-guardian guarantee.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: (skip commit — continue to Task 8)**

---

### Task 8: Handle empty-recipient sends and add new options to email page

**Files:**
- Modify: `src/actions/event-actions.ts:467-548` (inside `sendEventUpdateAction`)
- Modify: `src/app/(app)/events/[eventId]/email/page.tsx:35-40`

- [ ] **Step 1: Short-circuit on empty recipients**

In [src/actions/event-actions.ts](src/actions/event-actions.ts), inside `sendEventUpdateAction`, **immediately after** the call to `listEventUpdateRecipients` (currently line 477-481), insert:

```ts
  if (recipients.length === 0) {
    revalidatePath(`/events/${parsed.eventId}`);
    redirect(`/events/${parsed.eventId}?saved=email-empty`);
  }
```

This prevents writing an `email_messages` row for a send that has nobody to receive it. The `?saved=email-empty` query param is a new flash variant; the event detail page already consumes `?saved=email`, so this is an additive signal that existing code ignores safely (it just won't show the "email sent" flash).

Note: if the project's `saved-flash` component has a switch on the param value, a mapped label ("No recipients — nothing was sent") can be added as part of a UX polish. For this plan, leaving it as a silent no-op on the client is acceptable — the more common case (recipients present) is unchanged.

- [ ] **Step 2: Add three new `<option>` elements to the email page**

In [src/app/(app)/events/[eventId]/email/page.tsx:35-40](src/app/(app)/events/[eventId]/email/page.tsx#L35-L40), replace:

```tsx
            <select id="audience" name="audience" defaultValue="ALL_GUARDIANS">
              <option value="ALL_GUARDIANS">All guardians</option>
              <option value="RESPONDED_PLAYERS">
                Guardians of players who responded
              </option>
            </select>
```

with:

```tsx
            <select id="audience" name="audience" defaultValue="ALL_GUARDIANS">
              <option value="ALL_GUARDIANS">All guardians</option>
              <option value="RESPONDED_PLAYERS">
                Guardians of players who responded
              </option>
              <option value="NON_RESPONDERS">
                Guardians of players who haven&apos;t responded
              </option>
              <option value="STAFF">Coaches &amp; admins</option>
              <option value="EVERYONE">Everyone (guardians + staff)</option>
            </select>
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/actions/event-actions.ts src/lib/data.ts src/app/\(app\)/events/\[eventId\]/email/page.tsx
git commit -m "$(cat <<'EOF'
Add non-responder / staff / everyone email audiences

Extends the event-update email flow with three new audience options:
- NON_RESPONDERS: guardians whose players still owe an RSVP
- STAFF: coaches & admins only
- EVERYONE: all guardians + staff

Short-circuits the action when the resolved recipient set is empty to
avoid writing phantom email_messages rows.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Full verification + manual smoke test

**Files:** (none modified)

- [ ] **Step 1: Final typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 2: Start dev server for manual smoke**

Run: `pnpm dev`
Expected: server starts without error.

- [ ] **Step 3: Manual smoke — Team Event creation**

In a browser, sign in as an admin (from seeded users). Go to the schedule or event list, create a new event with type "Team event". Verify:
- Form submits successfully.
- The new event appears on the schedule list with label "Team event".
- On the calendar view, the event cell uses the new gold `cal-event--team-event` styling.
- The event detail page shows a gold chip reading "Team event".
- No lineup link appears for the event (lineups stay game-only).

- [ ] **Step 4: Manual smoke — RSVP on the Team Event**

As a seeded guardian, navigate to the Team Event and submit an RSVP. Verify the response saves. Confirm with `pnpm db:studio` that a row exists in `player_event_responses` for the new event.

- [ ] **Step 5: Manual smoke — email audiences**

As an admin, go to any event's `/email` page. For each of the five audience options, submit a brief test message. After each send, query the database with `pnpm db:studio`:
- `email_messages.metadata->>'audience'` should contain the expected enum string.
- `email_recipients` count should roughly match the expected set (e.g., `STAFF` = number of coaches+admins on the team, `EVERYONE` = deduped union).
- For `NON_RESPONDERS`, first ensure at least one player has no RSVP on the event, send, confirm only their guardians are recipients.
- For the empty case, send `NON_RESPONDERS` on an event where every player has already responded — verify **no** new `email_messages` row is written and the UI redirects to `?saved=email-empty` (may render as a silent no-op; that's acceptable).

- [ ] **Step 6: (No commit — verification only)**

---

## Self-Review Results

Ran the self-review checklist on this plan against the spec.

**Spec coverage:**
- Email audience expansion → Task 7 (enum + resolver), Task 8 (form + empty guard). ✅
- Non-responder branch in `listEventUpdateRecipients` → Task 7 Step 2. ✅
- No idempotency key for manual sends → implemented by simply not touching `reminder_deliveries`. ✅
- `TEAM_EVENT` enum value + migration → Task 1. ✅
- RSVP parity with practice → no code change required (confirmed in plan prose and verified in Task 9 Step 4). ✅
- 24h cron picks up TEAM_EVENT → no code change required. ✅
- Lineups stay game-only → existing `eq(events.type, "GAME")` gates are sufficient; called out in prose. ✅
- `src/lib/event-display.ts` new file → Task 2. ✅
- Gold chip + CSS classes → Task 3 Step 5. ✅
- All callsite migrations → Tasks 3, 5. ✅
- Event form option → Task 4 Step 1. ✅
- Default duration for TEAM_EVENT → Task 4 Step 3 (2 hours, same as practice). ✅
- Seed data → Task 6. ✅
- Verification bar (`typecheck && lint` + manual smoke) → Task 9. ✅

**Placeholder scan:** no TBDs, TODOs, "similar to Task N", or bare "handle edge cases" language. Each step includes exact code or command.

**Type consistency:** `eventTypeLabel` / `eventTypeCalendarClass` names used consistently in Tasks 2, 3, 5. Zod enum values match the Postgres enum values match the `EventType` TS union. `listEventUpdateRecipients` union matches the Zod audience enum. Signature changes in `defaultEndFor` are paired with the argument-site (`parsed.type` in `createEventAction` and `updateEventAction` — already typed via the widened `eventSchema`).

**Scope:** Single deliverable PR covering two orthogonal additions; both are additive and backward-compatible. Seven code commits + optional smoke-test-only final step.
