# Twilio Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Poke-based iMessage provider with a Twilio SMS provider that actually delivers to parents' phones, including delivery-status and STOP-handling webhooks.

**Architecture:** Keep the `sendTeamText` abstraction and all DB tables/columns from PR #4 (`text_messages`, `text_recipients`, `text_opt_in`) — they're channel-agnostic. Swap out the single provider function (`postToPoke` → `postToTwilio`) and add two webhook routes for Twilio status callbacks and inbound STOP handling. Rename `IMESSAGE` → `SMS` in the one enum where it appears, and update all UI copy from "iMessage" to "text."

**Tech Stack:** Next.js App Router (server actions + route handlers), Drizzle ORM, Postgres, `twilio` Node SDK, existing `sendTeamText` wrapper.

**Verification bar:** No test runner in repo. Each task ends with `pnpm typecheck && pnpm lint` + the specified manual check. Final end-to-end test is a real Twilio send to the implementer's own phone.

**Pre-requisite (owner, not the agent):** Kick off Twilio Toll-Free Number verification in parallel (Twilio Console → Messaging → Regulatory Compliance → Toll-Free Verification). 3–5 business days. The code below works against an unverified TFN for testing (Twilio allows sends to verified-caller-IDs in trial mode), so implementation is not blocked.

---

## File Structure

**Create:**
- `src/lib/sms-provider.ts` — Twilio client + `sendSms()` wrapper. One responsibility: talk to Twilio.
- `src/app/api/sms/status/route.ts` — POST webhook from Twilio, updates `text_recipients.delivery_status`.
- `src/app/api/sms/inbound/route.ts` — POST webhook from Twilio for inbound messages (STOP handling).
- `drizzle/0006_rename_imessage_to_sms.sql` — rename `IMESSAGE` → `SMS` in `response_source` enum.

**Modify:**
- `src/lib/text-notifications.ts` — swap `postToPoke` call site for `sendSms`.
- `src/lib/env.ts` — remove `POKE_API_KEY`/`POKE_API_URL`/`isPokeConfigured`, add Twilio env vars + `isTwilioConfigured()`.
- `src/lib/rsvp-tokens.ts` — `RsvpTokenSource` type literal `"IMESSAGE"` → `"SMS"`.
- `src/lib/text-templates.ts` — remove `source: "IMESSAGE"` string, update comment copy.
- `src/db/schema.ts` — rename enum value `IMESSAGE` → `SMS` in `responseSourceEnum`.
- `src/app/texts/off/[token]/page.tsx` — UI copy "iMessage nudges" → "text messages."
- `src/lib/reminders.ts` — any `iMessage` comments/strings → `text`/`SMS` (keep `NON_RESPONDER_24H_SMS` enum value as-is — it was forward-compatible).
- `src/app/(app)/settings/profile/page.tsx` — label copy if "iMessage" appears.
- `src/app/(app)/events/[eventId]/attendance/page.tsx` — if `IMESSAGE` source label is shown, rename to `SMS`.
- `AGENTS.md` — env var list, architecture note about Twilio service.
- `package.json` — add `twilio` dependency.

**Delete:** none. All Poke traces are in files we're modifying.

---

## Task 1: Add Twilio env vars and install SDK

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `package.json` (via pnpm add)

- [ ] **Step 1: Install Twilio SDK**

Run:
```bash
pnpm add twilio
```

Expected: `twilio` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Replace Poke env keys with Twilio keys**

Replace the body of `src/lib/env.ts` with:

```ts
export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/softball",
  AUTH_SECRET:
    process.env.AUTH_SECRET ?? "development-secret-change-before-production",
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  AUTH_RESEND_FROM:
    process.env.AUTH_RESEND_FROM ?? "BGSL <hello@example.com>",
  AUTH_RESEND_FROM_NAME:
    process.env.AUTH_RESEND_FROM_NAME ?? "Beverly Softball",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
  TWILIO_STATUS_CALLBACK_URL: process.env.TWILIO_STATUS_CALLBACK_URL ?? "",
};

export function isResendConfigured() {
  return Boolean(env.RESEND_API_KEY && env.AUTH_RESEND_FROM);
}

export function isTwilioConfigured() {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_FROM_NUMBER,
  );
}
```

Rationale:
- `TWILIO_STATUS_CALLBACK_URL` is optional — when unset we skip the callback arg. Useful for local dev where there's no public URL; Twilio will still deliver, we just won't update `delivery_status` asynchronously. Production sets it to `https://<app>/api/sms/status`.
- Removing `POKE_API_KEY`, `POKE_API_URL`, `isPokeConfigured()` — these have no remaining consumers after Task 2.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`

Expected: FAILS — `isPokeConfigured` is still imported in `src/lib/text-notifications.ts`. That's the next task. Record the expected-fail names (`POKE_API_URL`, `POKE_API_KEY`, `isPokeConfigured`) and continue.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/env.ts
git commit -m "Add Twilio env vars and SDK, drop Poke env"
```

---

## Task 2: Create SMS provider module

**Files:**
- Create: `src/lib/sms-provider.ts`

- [ ] **Step 1: Write the provider module**

Create `src/lib/sms-provider.ts`:

```ts
import Twilio from "twilio";

import { env, isTwilioConfigured } from "@/lib/env";

type SendSmsResult =
  | {
      status: "SENT";
      providerMessageId: string | null;
      errorMessage: null;
    }
  | {
      status: "FAILED";
      providerMessageId: null;
      errorMessage: string;
    }
  | {
      status: "CONSOLE_FALLBACK";
      providerMessageId: string;
      errorMessage: null;
    };

let cachedClient: ReturnType<typeof Twilio> | null = null;

function client() {
  if (cachedClient) return cachedClient;
  cachedClient = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return cachedClient;
}

export async function sendSms({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<SendSmsResult> {
  if (!isTwilioConfigured()) {
    // Local dev / unset Twilio: log to console and pretend it sent so the
    // rest of the flow (DB rows, reminder idempotency) exercises correctly.
    console.info(`[sms:console] ${to}\n${body}`);
    return {
      status: "CONSOLE_FALLBACK",
      providerMessageId: `console-${Date.now()}-${to}`,
      errorMessage: null,
    };
  }

  try {
    const message = await client().messages.create({
      to,
      from: env.TWILIO_FROM_NUMBER,
      body,
      ...(env.TWILIO_STATUS_CALLBACK_URL
        ? { statusCallback: env.TWILIO_STATUS_CALLBACK_URL }
        : {}),
    });

    // Twilio accepts the message into its queue and returns a sid. Actual
    // delivery status arrives asynchronously via the statusCallback webhook,
    // which flips the row from PENDING → SENT/FAILED. We treat "accepted by
    // Twilio" as "SENT from our perspective" because reminder idempotency
    // needs a definitive post-attempt state; the webhook refines it.
    return {
      status: "SENT",
      providerMessageId: message.sid,
      errorMessage: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Twilio send failed.";
    return {
      status: "FAILED",
      providerMessageId: null,
      errorMessage: message,
    };
  }
}
```

Design notes:
- `CONSOLE_FALLBACK` is its own status so the caller can decide whether to write `SENT` or a different value to the DB. For reminder idempotency parity with the prior Poke implementation we treat it as SENT; if we later want to distinguish, it's already plumbed.
- Client is memoized on module scope to avoid per-call HTTPS handshakes.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS for the new file. Overall project may still fail because `text-notifications.ts` hasn't been updated — OK, that's next task.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sms-provider.ts
git commit -m "Add Twilio SMS provider module"
```

---

## Task 3: Swap `postToPoke` call site in `sendTeamText`

**Files:**
- Modify: `src/lib/text-notifications.ts`

- [ ] **Step 1: Replace the provider call**

In `src/lib/text-notifications.ts`, replace:

```ts
import { env, isPokeConfigured } from "@/lib/env";
```

with:

```ts
import { sendSms } from "@/lib/sms-provider";
```

Then replace the entire `try` block in the `sendResults` map (currently lines ~55-101) with:

```ts
try {
  const override = input.renderBody
    ? await input.renderBody({
        ...recipient,
        userId: recipient.userId ?? null,
      })
    : undefined;
  const body = override?.body ?? input.body;

  const result = await sendSms({ to: recipient.phone, body });

  if (result.status === "FAILED") {
    return {
      recipient,
      deliveryStatus: "FAILED" as const,
      providerMessageId: null,
      deliveredAt: null,
      errorMessage: result.errorMessage,
    };
  }

  // SENT or CONSOLE_FALLBACK: Twilio accepted the message. Real delivery
  // status arrives via the /api/sms/status webhook, which will upgrade
  // the row if delivery actually confirmed, or mark FAILED if it didn't.
  // We record PENDING here to keep the row honest: "Twilio accepted but
  // delivery unconfirmed" is the literal state.
  return {
    recipient,
    deliveryStatus: "PENDING" as const,
    providerMessageId: result.providerMessageId,
    deliveredAt: null,
    errorMessage: null,
  };
} catch (error) {
  return {
    recipient,
    deliveryStatus: "FAILED" as const,
    providerMessageId: null,
    deliveredAt: null,
    errorMessage:
      error instanceof Error ? error.message : "SMS send failed.",
  };
}
```

Then delete the `postToPoke` function at the bottom of the file (~lines 195-226) entirely.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS. No remaining references to `postToPoke`, `isPokeConfigured`, `env.POKE_*`.

- [ ] **Step 3: Manual sanity — console fallback send**

With no `TWILIO_ACCOUNT_SID` set locally, run:

```bash
pnpm tsx -e "
import { sendSms } from './src/lib/sms-provider';
sendSms({ to: '+15555555555', body: 'console fallback test' }).then(console.log);
"
```

Expected: logs `[sms:console] +15555555555\nconsole fallback test` and returns `{status: 'CONSOLE_FALLBACK', ...}`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/text-notifications.ts
git commit -m "Route sendTeamText through Twilio SMS provider"
```

---

## Task 4: Rename `IMESSAGE` → `SMS` in code (schema enum + TS types)

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/lib/rsvp-tokens.ts`
- Modify: `src/lib/text-templates.ts`
- Modify: `src/app/(app)/events/[eventId]/attendance/page.tsx` (if label exists)

- [ ] **Step 1: Rename in schema**

In `src/db/schema.ts`, change:

```ts
export const responseSourceEnum = pgEnum("response_source", [
  "APP",
  "EMAIL_LINK",
  "COACH_MANUAL",
  "IMESSAGE",
]);
```

to:

```ts
export const responseSourceEnum = pgEnum("response_source", [
  "APP",
  "EMAIL_LINK",
  "COACH_MANUAL",
  "SMS",
]);
```

- [ ] **Step 2: Rename in rsvp-tokens type**

In `src/lib/rsvp-tokens.ts`, change:

```ts
export type RsvpTokenSource = "EMAIL_LINK" | "IMESSAGE";
```

to:

```ts
export type RsvpTokenSource = "EMAIL_LINK" | "SMS";
```

- [ ] **Step 3: Rename in text-templates**

In `src/lib/text-templates.ts`, change:

```ts
source: "IMESSAGE",
```

to:

```ts
source: "SMS",
```

Also update the comment on line 28 from `// TODO (you): write the iMessage body copy.` to `// TODO (you): write the text body copy.` and change "iMessage" → "text" anywhere else in comments/copy in this file.

- [ ] **Step 4: Search for remaining IMESSAGE/iMessage references in app code**

Run:

```bash
grep -rn "IMESSAGE\|iMessage" src/
```

Expected: only matches in tasks below (unsubscribe page copy, attendance page display label if any). Any production-code match (action payloads, enum comparisons, switch branches) must be updated to `SMS` in this task.

If the attendance page shows a source label to users, rename `"IMESSAGE"` → `"SMS"` in whatever display map or conditional produces it.

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS. No `IMESSAGE` string literals remain in src/.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/lib/rsvp-tokens.ts src/lib/text-templates.ts src/app/
git commit -m "Rename IMESSAGE → SMS in enum and TypeScript types"
```

---

## Task 5: Generate and apply enum rename migration

**Files:**
- Create: `drizzle/0006_*.sql` (drizzle-kit generates filename)

- [ ] **Step 1: Attempt to generate via drizzle-kit**

Run: `pnpm db:generate`

Expected: drizzle-kit either generates a migration with `ALTER TYPE ... RENAME VALUE 'IMESSAGE' TO 'SMS'`, OR refuses to generate enum-value renames and outputs a warning.

If drizzle-kit generates it automatically: skip to Step 3.
If drizzle-kit fails or emits a drop+recreate (dangerous): continue to Step 2.

- [ ] **Step 2: Hand-write the migration (if drizzle-kit didn't)**

Create `drizzle/0006_rename_imessage_to_sms.sql`:

```sql
ALTER TYPE "public"."response_source" RENAME VALUE 'IMESSAGE' TO 'SMS';
```

Also append an entry to `drizzle/meta/_journal.json` incrementing `idx` + add a `0006_snapshot.json` by running `pnpm db:generate` a second time — drizzle-kit will pick up the hand-written SQL and reconcile the snapshot. If it still doesn't, the simplest reconciliation is to run the migration once against local and prod manually (Step 4) and add the journal entry by hand following the 0005 entry as a template.

- [ ] **Step 3: Apply locally**

Run:

```bash
pnpm db:migrate
```

Expected: migration applies cleanly; `psql $DATABASE_URL -c "SELECT enum_range(NULL::response_source);"` includes `SMS` and not `IMESSAGE`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm build`

Expected: all PASS. Build must pass because schema enum + TS types are now consistent.

- [ ] **Step 5: Commit**

```bash
git add drizzle/
git commit -m "Add migration renaming IMESSAGE enum value to SMS"
```

Note for prod deploy: this migration must run against Railway Postgres *before* the Vercel deploy goes live, otherwise the app will send an enum value (`SMS`) the DB doesn't know yet. Since prod currently has 0 rows using `IMESSAGE`, apply order is:
1. Run migration against prod (`DATABASE_URL=<prod> pnpm db:migrate`).
2. Merge PR / let Vercel deploy.

---

## Task 6: Update unsubscribe page copy

**Files:**
- Modify: `src/app/texts/off/[token]/page.tsx`

- [ ] **Step 1: Replace "iMessage" wording**

In `src/app/texts/off/[token]/page.tsx`:

- Line 40: change `"You won't receive any more iMessage nudges from BGSL. We'll keep emailing you reminders if your email is on file."` to `"You won't receive any more text messages from BGSL. We'll keep emailing you reminders if your email is on file."`
- Line 61: change `"Turn off iMessage nudges?"` to `"Turn off text messages?"`
- Line 63: change `"You'll stop receiving iMessages from BGSL. Email reminders will continue."` to `"You'll stop receiving texts from BGSL. Email reminders will continue."`

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/texts/off/[token]/page.tsx
git commit -m "Update unsubscribe page copy from iMessage to text"
```

---

## Task 7: Twilio delivery-status webhook

**Files:**
- Create: `src/app/api/sms/status/route.ts`

- [ ] **Step 1: Write the route handler**

Create `src/app/api/sms/status/route.ts`:

```ts
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { db } from "@/db";
import { textRecipients } from "@/db/schema";
import { env } from "@/lib/env";

// Twilio posts status callbacks as application/x-www-form-urlencoded with
// fields including MessageSid, MessageStatus ("queued"|"sent"|"delivered"|
// "undelivered"|"failed"), ErrorCode, ErrorMessage.
//
// We validate the X-Twilio-Signature header to prove the request came from
// Twilio and wasn't forged.
export async function POST(request: NextRequest) {
  if (!env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ ok: false, reason: "twilio_not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const url = request.url;
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const valid = twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    params,
  );

  if (!valid) {
    return NextResponse.json({ ok: false, reason: "bad_signature" }, { status: 403 });
  }

  const messageSid = params.MessageSid;
  const status = params.MessageStatus;
  const errorMessage = params.ErrorMessage ?? null;

  if (!messageSid || !status) {
    return NextResponse.json({ ok: false, reason: "missing_fields" }, { status: 400 });
  }

  const now = new Date();

  const deliveryStatus =
    status === "delivered"
      ? ("SENT" as const)
      : status === "failed" || status === "undelivered"
        ? ("FAILED" as const)
        : ("PENDING" as const);

  await db
    .update(textRecipients)
    .set({
      deliveryStatus,
      deliveredAt: deliveryStatus === "SENT" ? now : null,
      errorMessage: deliveryStatus === "FAILED" ? errorMessage : null,
      updatedAt: now,
    })
    .where(eq(textRecipients.providerMessageId, messageSid));

  return NextResponse.json({ ok: true });
}
```

Design notes:
- Status callbacks fire multiple times during a single message's lifecycle (`queued` → `sent` → `delivered`). We map only terminal states (`delivered`, `failed`, `undelivered`) to non-PENDING — intermediate statuses just overwrite PENDING with PENDING, which is a no-op in practice.
- `twilio.validateRequest` uses HMAC-SHA1 over the request URL + sorted body params, keyed with the auth token. It's the canonical Twilio webhook auth.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS.

- [ ] **Step 3: Manual verification against Twilio docs**

Confirm these three config values match:
- Twilio Console → Phone Numbers → your TFN → Messaging → "A MESSAGE COMES IN" is left alone (that's the inbound handler, Task 8). This webhook is the *status callback* URL, set per-message via `statusCallback` arg (already wired in Task 2's `sendSms`).
- Production env: `TWILIO_STATUS_CALLBACK_URL=https://<prod-host>/api/sms/status`.
- The validateRequest call reconstructs the URL from `request.url`. Vercel behind a proxy can trip this — if signature validation fails in prod, check that `request.url` returns the public URL Twilio hit, not the internal one. If it doesn't, swap to explicit URL construction via `NEXT_PUBLIC_APP_URL`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sms/status/route.ts
git commit -m "Add Twilio delivery-status webhook"
```

---

## Task 8: Twilio inbound webhook (STOP handling)

**Files:**
- Create: `src/app/api/sms/inbound/route.ts`

- [ ] **Step 1: Write the inbound handler**

Create `src/app/api/sms/inbound/route.ts`:

```ts
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { db } from "@/db";
import { adultUsers } from "@/db/schema";
import { env } from "@/lib/env";

// Twilio's carrier-level STOP handling auto-blacklists the sender from
// receiving further messages, but does not tell our app about it. Without
// this webhook, the admin UI would still show `text_opt_in = true` for
// users who have opted out, and we'd keep trying to send (Twilio would
// reject with 21610). This webhook keeps our DB honest.
//
// Twilio posts to "A MESSAGE COMES IN" URL configured on the phone number.
// Body fields we care about: From (E.164), Body (text the user sent).
export async function POST(request: NextRequest) {
  if (!env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const url = request.url;
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const valid = twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    params,
  );
  if (!valid) {
    return new NextResponse("", { status: 403 });
  }

  const from = params.From ?? "";
  const bodyText = (params.Body ?? "").trim().toUpperCase();

  // Twilio treats these keywords as opt-out; we mirror that list so our
  // DB matches what Twilio will enforce at the network edge.
  const optOutKeywords = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];

  if (from && optOutKeywords.includes(bodyText)) {
    // Match user by phone. We store phones in the original formatted form
    // (e.g. "718-316-2321"); Twilio sends E.164 ("+17183162321"). Normalize
    // to digits-only for comparison.
    const digits = from.replace(/\D/g, "");
    await db
      .update(adultUsers)
      .set({ textOptIn: false, updatedAt: new Date() })
      // Postgres equivalent of normalizing both sides to digits.
      // regexp_replace is available in all supported PG versions.
      .where(
        // eslint-disable-next-line drizzle/enforce-eq-operator
        eq(
          // @ts-expect-error — we wrap phone in regexp_replace via sql`` below
          null,
          null,
        ),
      );

    // Replace the placeholder above with the explicit sql`` update:
  }

  // Respond with empty TwiML so Twilio doesn't auto-reply.
  return new NextResponse(
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>",
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );
}
```

**Implementation note for the agent:** the drizzle `eq` pattern on normalized phone digits is awkward with the regular `eq` helper. Use `sql` template instead — replace the entire `if (from && optOutKeywords.includes(bodyText)) { ... }` block with:

```ts
import { sql } from "drizzle-orm";
// ...

if (from && optOutKeywords.includes(bodyText)) {
  const digits = from.replace(/\D/g, "");
  await db
    .update(adultUsers)
    .set({ textOptIn: false, updatedAt: new Date() })
    .where(sql`regexp_replace(${adultUsers.phone}, '\D', '', 'g') = ${digits}`);
}
```

(add the `sql` import at the top alongside `eq`.)

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sms/inbound/route.ts
git commit -m "Add Twilio inbound STOP webhook"
```

---

## Task 9: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update env vars section**

In `AGENTS.md`, find the "Environment" section and replace:

```
`src/lib/env.ts` reads env vars with dev fallbacks. Required for real runs: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `AUTH_RESEND_FROM`, `RESEND_API_KEY`.
```

with:

```
`src/lib/env.ts` reads env vars with dev fallbacks. Required for real runs: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `AUTH_RESEND_FROM`, `RESEND_API_KEY`. For SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (E.164). Optional: `TWILIO_STATUS_CALLBACK_URL` (defaults to empty — set to `https://<app>/api/sms/status` in prod so delivery status updates the `text_recipients` row).
```

- [ ] **Step 2: Update text-channel architecture note**

In the Architecture section, find any reference to Poke/iMessage and replace with a description of the Twilio path. Specifically, add under "### Email" a sibling "### SMS" section:

```
### SMS

[src/lib/text-notifications.ts](src/lib/text-notifications.ts) `sendTeamText()` writes `text_messages` + `text_recipients` rows, then calls [src/lib/sms-provider.ts](src/lib/sms-provider.ts) `sendSms()` which sends via Twilio. Delivery starts as `PENDING`; Twilio's status callback at `/api/sms/status` flips it to `SENT` or `FAILED`. Inbound STOP messages at `/api/sms/inbound` flip `adult_users.text_opt_in` so the admin UI stays in sync with Twilio's carrier-level opt-out.

Channel selection is per-recipient: if `adult_users.text_opt_in = true` AND `adult_users.phone` is set, the recipient gets SMS; otherwise email. The broadcast action in [src/actions/event-actions.ts](src/actions/event-actions.ts) splits recipients into two disjoint sets and sends through both channels — each person receives exactly one message.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "Document Twilio SMS channel in AGENTS.md"
```

---

## Task 10: End-to-end verification

Owner-run (requires Twilio credentials and TFN).

- [ ] **Step 1: Populate Vercel + Railway env vars**

In Vercel (web app) and Railway (reminders service):

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+18005551234   # your TFN, E.164
TWILIO_STATUS_CALLBACK_URL=https://bgsl.vercel.app/api/sms/status
```

In Twilio Console → Phone Numbers → your TFN → Messaging:
- "A MESSAGE COMES IN" → `https://bgsl.vercel.app/api/sms/inbound` (POST).

Remove stale Poke vars from both services: `POKE_API_KEY`, `POKE_API_URL`.

- [ ] **Step 2: Deploy**

Before Vercel finishes deploying, apply the enum migration to prod:

```bash
DATABASE_URL="<prod url>" pnpm db:migrate
```

Then merge the branch.

- [ ] **Step 3: Send real test broadcast**

From the app UI, create a throwaway event, set yourself as a text-opted-in coach (you already are per earlier work), and use "Email families" to broadcast a short test to yourself only. (Temporarily remove other coaches' `text_opt_in` if you want to isolate yourself.)

Expected:
- SMS arrives on your phone from the Twilio TFN.
- `SELECT delivery_status, provider_message_id FROM text_recipients ORDER BY created_at DESC LIMIT 1;` starts as `PENDING` with a `SM...` sid, then updates to `SENT` with a `delivered_at` timestamp within seconds (Twilio fires the status callback on delivery).

- [ ] **Step 4: Verify STOP path**

Reply `STOP` to the test SMS.

Expected:
- Twilio's auto-reply acknowledges STOP (automatic, no code needed).
- `SELECT text_opt_in FROM adult_users WHERE email = 'jelee85@gmail.com';` returns `false`.
- Subsequent broadcast to "All guardians" does not text you (channel split moves you to the email bucket because `text_opt_in` is now false).

- [ ] **Step 5: Restore your own opt-in**

```sql
UPDATE adult_users SET text_opt_in = true WHERE email = 'jelee85@gmail.com';
```

And text `START` to the Twilio number to clear Twilio's own blacklist.

- [ ] **Step 6: Done**

Feature is live.

---

## Self-Review

**Spec coverage check:**
- Rip out Poke: Tasks 1, 2, 3 (env, provider, call-site) → covered.
- Swap to Twilio TFN: Tasks 2, 3, 10 (provider, wiring, deploy) → covered.
- Delivery-status handling: Task 7 → covered.
- STOP handling: Task 8 → covered.
- Enum rename: Tasks 4, 5 → covered.
- UI copy: Task 6 → covered.
- Docs: Task 9 → covered.
- End-to-end verification: Task 10 → covered.

**Placeholder scan:** no TODOs, "similar to Task N," or "implement later" markers. Task 8's inbound handler intentionally shows the awkward-eq placeholder then replaces it — kept for pedagogical clarity, but the final code block is complete.

**Type consistency:**
- `SendSmsResult` (Task 2) — three variants consumed by Task 3's call site. Variants match.
- `RsvpTokenSource = "EMAIL_LINK" | "SMS"` (Task 4) — referenced by `text-templates.ts` in same task.
- `deliveryStatus` values `"PENDING" | "SENT" | "FAILED"` match the `delivery_status` pg enum in existing schema.

Plan is internally consistent.
