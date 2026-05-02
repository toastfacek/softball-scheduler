# BGSL (Beverly Girls Softball League)

A private, mobile-first softball team management app for one current-season team. Parents update player availability, coaches plan lineups, and admins keep the schedule and communication organized without turning every update into a text-thread pileup.

## What’s inside

- Magic-link sign in with `Auth.js` + Resend
- Team roster with up to two guardians per player
- Practice and game schedule with location + directions
- Parent RSVP flow with `Available / Unavailable / Maybe`
- Coach/admin actual attendance tracking
- Coach-only inning-by-inning lineup planner
- Manual team/event emails plus automatic two-day non-responder reminders
- PWA manifest so families can install the app to their home screen

## Stack

- `Next.js` App Router + TypeScript
- `Drizzle ORM` + PostgreSQL
- `Auth.js` Drizzle adapter
- `Resend` for transactional email
- `Vercel` for the web app
- `Railway Postgres` for the database
- `Railway Cron` for reminder delivery every 15 minutes

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Add your real values to `.env.local`:

- `DATABASE_URL`: your Railway Postgres connection string
- `AUTH_SECRET`: a long random secret
- `NEXT_PUBLIC_APP_URL`: your local or deployed app URL
- `AUTH_RESEND_FROM`: a verified sender in Resend
- `RESEND_API_KEY`: your Resend API key

4. Generate and run the database migration:

```bash
pnpm db:generate
pnpm db:migrate
```

5. Seed a starter team:

```bash
pnpm db:seed
```

6. Start the app:

```bash
pnpm dev
```

## Useful commands

```bash
pnpm lint
pnpm typecheck
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm cron:reminders
```

## Railway + Vercel deployment notes

### Vercel app

- Set the same environment variables in Vercel.
- Deploy the Next.js app normally.

### Railway Postgres

- Create a PostgreSQL service in Railway.
- Copy its `DATABASE_URL` into both local `.env.local` and Vercel.

### Railway reminder cron

Create a small Railway service from this same repo that runs:

```bash
pnpm cron:reminders
```

Schedule it every 15 minutes. The reminder runner sends reminders once an event is inside the next 48 hours and is idempotent at the database level, so duplicate runs should not send duplicate reminder emails.

## Demo seed accounts

After `pnpm db:seed`, these emails exist as invited accounts:

- `jesse.admin@example.com`
- `marta.coach@example.com`
- `alex.family@example.com`

Use one of those emails on the sign-in screen to receive a magic link from Resend.
