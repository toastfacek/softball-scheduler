<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: BGSL (Beverly Girls Softball League)

Private, mobile-first, single-team softball app. Parents RSVP, coaches plan lineups, admins run comms. Next.js App Router + Drizzle/Postgres + Auth.js (Resend magic links). Deployed: web on Vercel, Postgres + reminder cron on Railway.

## Commands

```bash
pnpm dev              # local dev server
pnpm build            # production build
pnpm lint             # eslint
pnpm typecheck        # tsc --noEmit

pnpm db:generate      # create migration from schema changes
pnpm db:migrate       # apply migrations
pnpm db:seed          # tsx src/scripts/seed.ts — seeds demo team + invited adults
pnpm db:studio        # drizzle-kit studio

pnpm cron:reminders   # tsx src/scripts/send-reminders.ts — one reminder sweep
```

No test runner is configured. `pnpm typecheck && pnpm lint` is the verification bar.

Path alias: `@/*` → `./src/*`.

## Architecture

### Route groups (Next.js App Router)

- `src/app/(auth)/sign-in` — public; magic-link flow only.
- `src/app/(app)/**` — private. [src/app/(app)/layout.tsx](src/app/(app)/layout.tsx) calls `auth()` → redirects to `/sign-in` if no session, then loads `getViewerContext()` and renders a "no team linked" panel if the user exists but has no `team_memberships` row.
- `src/app/api/auth/[...nextauth]` — Auth.js handlers.

### Auth model (important and non-standard)

`signIn` callback in [src/auth.ts](src/auth.ts) **rejects** any Resend/email login whose normalized email is not already present in `adult_users`. "Inviting" a family means inserting their `adult_users` row (and a `team_memberships` row) before they sign in — there's no separate invite table. Sessions are DB-backed (`strategy: "database"`), not JWT.

### Viewer / authorization

All server-side role gating flows through one function:

- [src/lib/data.ts](src/lib/data.ts) `getViewerContext()` — `cache()`-wrapped per request. Returns `AppViewer` with `userId`, `teamId`, `seasonId`, `roles: TeamRole[]` (`PARENT` | `COACH` | `ADMIN`), `linkedPlayerIds`, plus denormalized team/season/adult info. Use this instead of re-querying session or memberships.
- [src/lib/authz.ts](src/lib/authz.ts) — pure predicates (`canManageTeam`, `canManageLineups`, `canManagePrivateContacts`).
- [src/actions/helpers.ts](src/actions/helpers.ts) — `requireViewer`, `requireTeamManager`, `requireLineupManager`. Every server action starts with one of these.

### Data layer

- Drizzle ORM over `postgres-js`. Single client cached on `globalThis` in dev to survive HMR ([src/db/index.ts](src/db/index.ts)).
- Schema is the source of truth: [src/db/schema.ts](src/db/schema.ts). Enums are Postgres enums. Notable unique indexes that encode business rules:
  - `player_event_responses (event_id, player_id)` — one RSVP per player per event.
  - `reminder_deliveries (event_id, user_id, reminder_type)` — **idempotency key** for the reminder cron; duplicate sweeps will not re-email.
  - `lineup_plans (event_id)` — at most one plan per event.
  - `batting_slots (plan_id, slot_number)` and `(plan_id, player_id)` — no slot collisions, no player batting twice.
- Mutations are Server Actions under [src/actions/](src/actions/), organized by domain (`event-actions`, `lineup-actions`, `team-actions`, `settings-actions`, `auth-actions`). Reads generally live in [src/lib/data.ts](src/lib/data.ts).

### Reminder cron

[src/scripts/send-reminders.ts](src/scripts/send-reminders.ts) + [src/lib/reminders.ts](src/lib/reminders.ts) is run as a **separate Railway service** (`Dockerfile.railway`, `railway.json` with `cronSchedule: "*/15 * * * *"`) — not via a Next.js route. It sends a 24h non-responder nudge per guardian per event, guarded by the `reminder_deliveries` unique index. The `metadata` field on `email_messages` carries `reminderType: "NON_RESPONDER_24H"` for audit.

### Email

[src/lib/notifications.ts](src/lib/notifications.ts) `sendTeamEmail()` writes an `email_messages` + `email_recipients` row per send, then calls Resend. Always go through it — don't call Resend directly — so delivery status is recorded and recipients are deduped.

### SMS

[src/lib/text-notifications.ts](src/lib/text-notifications.ts) `sendTeamText()` writes `text_messages` + `text_recipients` rows, then calls [src/lib/sms-provider.ts](src/lib/sms-provider.ts) `sendSms()` which sends via Twilio. Delivery starts as `PENDING`; Twilio's status callback at [src/app/api/sms/status/route.ts](src/app/api/sms/status/route.ts) flips it to `SENT` or `FAILED`. Inbound STOP messages at [src/app/api/sms/inbound/route.ts](src/app/api/sms/inbound/route.ts) flip `adult_users.text_opt_in` so the admin UI stays in sync with Twilio's carrier-level opt-out.

Channel selection is per-recipient: if `adult_users.text_opt_in = true` AND `adult_users.phone` is set, the recipient gets SMS; otherwise email. The broadcast action in [src/actions/event-actions.ts](src/actions/event-actions.ts) splits recipients into two disjoint sets and sends through both channels — each person receives exactly one message.

### UI

- Tailwind v4 with custom CSS variables (navy/orange palette). Global styles + design tokens in [src/app/globals.css](src/app/globals.css).
- Fonts: Barlow Condensed (display) + Sora (body), loaded via `next/font/google` in the root layout.
- Shared components live in [src/components/](src/components/) (`AppShell`, `EventCard`, `StatusChip`, `SubmitButton`, etc.). Role-aware nav is in `AppShell`.
- PWA manifest at [src/app/manifest.ts](src/app/manifest.ts).

## Environment

`src/lib/env.ts` reads env vars with dev fallbacks. Required for real runs: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `AUTH_RESEND_FROM`, `RESEND_API_KEY`. For SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (E.164). Optional: `TWILIO_STATUS_CALLBACK_URL` (set to `https://<app>/api/sms/status` in prod so delivery status updates the `text_recipients` row; leave empty in dev). Twilio inbound webhook (configured in Twilio Console on the phone number, not via env) points to `https://<app>/api/sms/inbound`.
