# Tee Up for Beverly Girls Softball — Technical Design

## Purpose

Implement the public BGSL golf tournament campaign at `https://beverlysoftball.com/golf-tournament` with paid Stripe Checkout registration/sponsorship purchase, post-payment detail completion, private logo upload, in-kind donation submissions, and an authenticated admin operations dashboard.

This TDD translates the product spec in `docs/superpowers/specs/2026-06-17-golf-tournament-landing-page.md` into implementation shape.

## High-Level Architecture

### Public surfaces

- `/golf-tournament` — public landing page with package cards, FAQ, add-to-calendar, sponsor logos, and raffle/in-kind form entry
- `/golf-tournament/complete/[token]` — private-by-link post-payment completion form
- `/golf-tournament/in-kind` or inline form action — no-payment raffle/in-kind donation form
- `/` — route public/signed-out visitors to `/golf-tournament`; route signed-in users to `/schedule`

### Private admin surfaces

- Recommended: `/settings/golf-tournament`
- Uses existing app authentication and `ADMIN` role via `getViewerContext()` / `requireTeamManager()`
- Initial admins are Jesse and Michelle via existing team membership roles

### Integrations

- Stripe Checkout for paid packages
- Stripe webhook for durable payment confirmation
- Resend via existing notification patterns for buyer/admin emails
- Cloudflare R2 for private sponsor logo/artwork storage
- Existing ICS/calendar helpers if practical for Add to Calendar

## Routing

### Public root routing

Current `src/app/page.tsx` redirects signed-out visitors to `/sign-in`. For the campaign:

```ts
if (session?.user?.id) redirect("/schedule");
redirect("/golf-tournament");
```

This preserves the private app entry for authenticated users while making the root useful for public campaign traffic.

### New route tree

Recommended files:

- `src/app/golf-tournament/page.tsx`
- `src/app/golf-tournament/complete/[token]/page.tsx`
- `src/app/golf-tournament/complete/[token]/completion-form.tsx`
- `src/app/golf-tournament/actions.ts` or `src/actions/golf-tournament-actions.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/(app)/settings/golf-tournament/page.tsx`
- `src/app/(app)/settings/golf-tournament/export/route.ts` or server action-driven CSV export
- Optional: `src/app/api/golf-tournament/calendar.ics/route.ts`

Use route-level metadata on `/golf-tournament` for title, description, and Open Graph image.

## Frontend Design System

Implementation must follow the public design-system direction:

- Design-system doc: `docs/superpowers/specs/2026-06-17-bgsl-public-design-system.md`
- Static preview/reference: `docs/bgsl-public-design-system-preview.html`
- Direction name: `Fairway Fundraiser`

Design goals:

- Golf-forward local event page, not SaaS marketing UI
- Fresh fairway green, mint, sand, sky, navy structure, and orange action accents
- BGSL logo used sparingly as a small proof mark, not the hero centerpiece
- Barlow Condensed for big event/editorial headings; Sora for body, forms, and details
- Event-page texture: scorecard fact rails, flyer-like section breaks, event-stamp details, fairway/flag/pin visual elements
- Sponsorship cards should feel like event placards, not generic pricing tiles

Frontend implementation guidance:

- Add route-specific public styles/classes rather than reusing private app shell components wholesale.
- Prefix public-event classes with `golf-` or `public-`.
- Keep `/settings/golf-tournament` inside the existing private app shell; only public buyer-facing pages use the public design system.
- Use square or low-radius placards for package cards.
- Avoid nested cards, glassmorphism, generic icon grids, product-dashboard spacing, and overly rounded SaaS buttons/cards.
- Use the BGSL logo small in the top brand row, footer, or social image only if it improves trust.
- If real photography is not ready, use abstract fairway/flag/scorecard visual elements rather than stock-looking golf photos.

Suggested public components:

- `GolfHero`
- `GolfFactRail`
- `GolfEventHighlights`
- `GolfPackageSection`
- `GolfPackagePlacard`
- `GolfSponsorWall`
- `GolfFaq`
- `GolfCompletionForm`
- `GolfLogoUpload`

## Package Configuration

Package definitions are developer-managed in v1. Use a typed config module rather than hardcoding directly inside components.

Recommended file:

- `src/lib/golf-tournament/packages.ts`

Shape:

```ts
export type GolfPackageKind = "GOLF" | "SPONSORSHIP";
export type IncludedGolf = "NONE" | "ONE_PLAYER" | "TWOSOME" | "FOURSOME";

export type GolfTournamentPackage = {
  id: string;
  kind: GolfPackageKind;
  category: "PLAY_GOLF" | "HOLE_OR_CONTEST" | "TOURNAMENT_EXPERIENCE";
  name: string;
  priceCents: number;
  publicDescription: string;
  benefits: string[];
  capacity: number | null;
  availabilityLabelWhenUncapped?: string;
  includedGolf: IncludedGolf;
  stripeProductName: string;
  isActive: boolean;
};
```

Notes:

- `capacity: null` means uncapped or not yet precisely capped.
- Foursome registration should have a configured max capacity before launch, even if the public page only shows `Sold out` when full.
- Stripe line items can be created dynamically from this config. Stripe Product/Price IDs are optional for v1; dynamic `price_data` is simpler for developer-managed packages.

## Proposed Database Changes

Add Postgres enums for clean status handling.

```ts
export const golfPurchaseTypeEnum = pgEnum("golf_purchase_type", [
  "GOLF",
  "SPONSORSHIP",
]);

export const golfPaymentStatusEnum = pgEnum("golf_payment_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELED",
  "REFUNDED",
]);

export const golfFulfillmentStatusEnum = pgEnum("golf_fulfillment_status", [
  "PAID_NEEDS_DETAILS",
  "DETAILS_SUBMITTED",
  "NEEDS_REVIEW",
  "COMPLETE",
]);

export const includedGolfIntentEnum = pgEnum("included_golf_intent", [
  "WILL_USE",
  "WILL_NOT_USE",
  "NOT_SURE",
]);

export const inKindStatusEnum = pgEnum("in_kind_status", [
  "NEW",
  "ACCEPTED",
  "NEEDS_FOLLOW_UP",
  "DECLINED",
]);
```

### `golf_tournament_purchases`

Stores paid package purchases and fulfillment state.

Fields:

- `id uuid primary key defaultRandom()`
- `package_id text not null`
- `purchase_type golf_purchase_type not null`
- `buyer_name text`
- `buyer_email text not null`
- `buyer_phone text`
- `amount_cents integer not null`
- `currency text default 'usd' not null`
- `payment_status golf_payment_status default 'PENDING' not null`
- `fulfillment_status golf_fulfillment_status default 'PAID_NEEDS_DETAILS' not null`
- `stripe_checkout_session_id text`
- `stripe_payment_intent_id text`
- `stripe_customer_id text`
- `completion_token_hash text not null`
- `completion_token_expires_at timestamp with time zone`
- `completion_token_revoked_at timestamp with time zone`
- `included_golf_intent included_golf_intent`
- `sponsor_display_name text`
- `sponsor_contact_name text`
- `sponsor_website_url text`
- `sponsor_recognition_name text`
- `sponsor_notes text`
- `approved_for_public_display boolean default false not null`
- `approved_public_display_at timestamp with time zone`
- `created_at`, `updated_at`
- `paid_at timestamp with time zone`
- `details_submitted_at timestamp with time zone`

Indexes:

- unique `stripe_checkout_session_id`
- unique `stripe_payment_intent_id`
- unique `completion_token_hash`
- index `package_id`
- index `payment_status`
- index `fulfillment_status`
- index `approved_for_public_display`

Security note: store only a hash of the completion token. Email/send the raw token; compare by hashing incoming token.

### `golf_tournament_players`

Stores golfer names for foursome purchases and included sponsor spots.

Fields:

- `id uuid primary key defaultRandom()`
- `purchase_id uuid references golf_tournament_purchases(id) on delete cascade`
- `slot_number integer not null`
- `name text`
- `email text`
- `created_at`, `updated_at`

Indexes:

- unique `(purchase_id, slot_number)`

Slot counts:

- Foursome: 4
- Twosome: 2
- One player: 1

Empty names may exist immediately after payment, but public foursome completion must require all four names before transitioning to `DETAILS_SUBMITTED`. Sponsor-included slots remain nullable pending the admin comp workflow.

### `golf_tournament_assets`

Stores uploaded logo/artwork metadata. Binary files live in R2.

Fields:

- `id uuid primary key defaultRandom()`
- `purchase_id uuid references golf_tournament_purchases(id) on delete cascade`
- `kind text default 'LOGO' not null`
- `r2_key text not null`
- `original_filename text not null`
- `content_type text not null`
- `size_bytes integer not null`
- `created_at`, `updated_at`

Indexes:

- index `purchase_id`
- unique `r2_key`

### `golf_tournament_in_kind_submissions`

Stores no-payment raffle/in-kind offers.

Fields:

- `id uuid primary key defaultRandom()`
- `donor_name text not null`
- `contact_name text not null`
- `email text not null`
- `phone text`
- `item_description text not null`
- `estimated_value_cents integer`
- `pickup_notes text`
- `status in_kind_status default 'NEW' not null`
- `admin_notes text`
- `created_at`, `updated_at`

Indexes:

- index `status`
- index `email`

## Stripe Checkout Flow

### Create checkout session

Server action or route:

- `createGolfCheckoutSessionAction(packageId: string)`

Flow:

1. Validate `packageId` against `packages.ts`.
2. Confirm package is active.
3. Calculate paid count for package where `payment_status = 'PAID'`.
4. If capacity is reached, return sold-out response.
5. Create a purchase row with:
   - package ID
   - purchase type
   - amount
   - `payment_status = 'PENDING'`
   - generated completion token hash
6. Create Stripe Checkout Session:
   - mode `payment`
   - line item dynamic price data from package
   - success URL to completion page token, or to a session handoff route that resolves the token
   - cancel URL `/golf-tournament`
   - metadata: `purchaseId`, `packageId`
   - customer email collected by Stripe Checkout
7. Save `stripe_checkout_session_id` on the purchase.
8. Redirect to `session.url`.

Implementation detail: if the completion token exists before payment, the completion page must not allow editing until `payment_status = 'PAID'`. It can show a pending/return-to-page message if visited early.

### Webhook

Route:

- `src/app/api/stripe/webhook/route.ts`

Events to handle:

- `checkout.session.completed`
- Optional: `checkout.session.expired`
- Optional: `payment_intent.payment_failed`
- Optional: `charge.refunded` / `payment_intent.canceled` for status reflection only, not in-app refund control

On `checkout.session.completed`:

1. Verify Stripe signature using `STRIPE_WEBHOOK_SECRET`.
2. Find purchase by `metadata.purchaseId` or session ID.
3. Re-check package capacity based on already-paid purchases.
4. Mark purchase `PAID`, set `paid_at`, store buyer email/name/customer/payment intent.
5. Initialize player slots based on package included golf capacity.
6. Send BGSL buyer confirmation email with completion link.
7. Send admin purchase notification email.
8. If rare inventory conflict is detected, mark as paid but `NEEDS_REVIEW` and notify admins to resolve manually.

Webhook handler must be idempotent:

- If purchase is already `PAID`, do not resend emails unless explicitly designed.
- Use payment status transitions carefully.

## Completion Form

Route:

- `/golf-tournament/complete/[token]`

Access model:

- Private-by-link.
- Hash token and look up purchase.
- Reject revoked/invalid tokens.
- If after tournament + 30 days, show read-only/closed state.
- Do not require app login.

Form behavior:

- Show confirmation first: `You're confirmed. Help us finish your tournament details.`
- Require buyer/contact phone.
- Let buyer update and resubmit details multiple times while active.
- Store `details_submitted_at` and `updated_at`.

Fields by purchase type:

- All:
  - buyer/contact name
  - buyer/contact phone
  - notes
- Foursome:
  - required player slots 1-4
  - client and server validation must reject incomplete public foursomes
- Sponsor:
  - sponsor/business display name
  - sponsor contact name
  - website URL
  - recognition name
  - included golfer intent if applicable
  - player slots if using included golf
  - sponsor notes
  - logo/artwork upload

Status transition:

- On submit, move from `PAID_NEEDS_DETAILS` to `DETAILS_SUBMITTED`.
- If logo uploaded or sponsor public display info changed, consider `NEEDS_REVIEW`.
- Admin later marks `COMPLETE`.

## Logo Upload / Cloudflare R2

Recommended file:

- `src/lib/golf-tournament/storage.ts`

Environment variables:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`
- Optional `CLOUDFLARE_R2_PUBLIC_BASE_URL` only for later approved public assets

Rules:

- Max size 10 MB.
- Allowed extensions/content types:
  - PNG
  - JPG/JPEG
  - SVG
  - PDF
- Store objects private by default.
- Object key pattern: `golf-tournament/2026/{purchaseId}/logo-original.{ext}`.
- Save metadata in `golf_tournament_assets`.

Public sponsor logos:

- Do not expose raw private upload URLs.
- Admin approves sponsor for public display.
- For public display, either:
  - generate signed/read URLs server-side, or
  - copy approved web-safe assets to a public prefix/bucket.

Recommendation for v1: keep public sponsor wall simple and serve approved logos through a controlled route that checks `approved_for_public_display`.

- Hide the entire wall when no approved tournament sponsors exist.
- Render approved sponsor website URLs as external links with `target="_blank"` and `rel="noreferrer"`.
- Never render league-sponsor placeholders in the tournament sponsor wall.

## Admin Sponsor Adjustments

Michelle may need to register sponsor golfers under exceptional payment arrangements, for example four players with only three paid spots.

- Keep this out of public checkout; no public discount codes.
- Add an authenticated admin action that can create or adjust a purchase with standard amount, actual charged amount, adjustment reason, and admin identity.
- Allow admins to populate golfer slots for sponsor packages.
- Preserve Stripe as payment source of truth and show any difference between package value and collected amount in the admin dashboard/export.
- This is a post-review implementation item and is not required for the public visual review build.

## In-Kind Donation Flow

Server action:

- `submitGolfInKindDonationAction(formData)`

Validation:

- donor/business name required
- contact name required
- email required and valid
- phone optional
- item/service description required
- estimated value optional
- pickup/drop-off notes optional

On submit:

- Create `golf_tournament_in_kind_submissions` with status `NEW`.
- Send confirmation email to donor.
- Send admin notification to Michelle/Jesse.
- Show a thank-you state on the public page or redirect to a thank-you anchor.

Admin can update status:

- `NEW`
- `ACCEPTED`
- `NEEDS_FOLLOW_UP`
- `DECLINED`

## Email Design

Use existing Resend setup and email helper patterns. Do not use SMS.

### Buyer confirmation email

Sent after Stripe confirms payment.

Includes:

- Confirmation that package is paid/confirmed
- Package name and amount
- Completion link
- Tournament contact email: `mishlambert10@gmail.com`
- Safe proceeds language
- No tax-deductible claim

### Admin purchase notification

Sent after paid purchase.

Includes:

- Package
- Buyer name/email if known
- Amount
- Stripe session/payment reference
- Link to admin dashboard

### Detail update notification

Sent when completion form is submitted/updated.

Includes:

- Package
- Buyer/sponsor name
- Missing/updated details summary
- Link to admin dashboard

### In-kind notification

Sent when raffle/in-kind form is submitted.

Includes:

- donor
- item description
- estimated value
- contact info

## Admin Dashboard

Route:

- `/settings/golf-tournament`

Authorization:

- Existing private app auth.
- Require admin/team manager role.

Dashboard sections:

- Summary totals:
  - gross paid
  - estimated Stripe fees
  - estimated net
  - purchase count by package
  - remaining inventory
- Tabs/filters:
  - All
  - Golfers
  - Sponsors
  - Missing details
  - Approved public logos
  - In-kind submissions
- Purchase table:
  - package
  - buyer email/name/phone
  - payment status
  - fulfillment status
  - amount
  - player names summary
  - sponsor display/logo status
  - Stripe reference/link
  - updated timestamp
- Purchase detail panel/page:
  - all form details
  - asset download links
  - approve/unapprove public sponsor logo/name
  - mark fulfillment status
  - resend completion link
- CSV export:
  - operational fields only
  - exclude completion tokens/links

Estimated fee formula for standard domestic card planning:

```ts
estimatedFeeCents = Math.round(amountCents * 0.029) + 30;
estimatedNetCents = amountCents - estimatedFeeCents;
```

Label all fee/net values as estimated. Stripe remains financial source of truth.

## Public Sponsor Wall

Landing page can query approved sponsor purchases:

- `payment_status = 'PAID'`
- `approved_for_public_display = true`
- sponsor display/recognition name present
- logo asset available if using logos

Behavior:

- Hide section if no approved sponsors.
- Show one simple logo/name grid.
- Optional small sponsorship-level label.
- No complex tiered sizing in v1.

## Calendar

Add a simple `Add to Calendar` action for:

- Tee Up for Beverly Girls Softball
- Monday, September 28, 2026
- 10:00 AM America/New_York
- Beverly Golf & Tennis Club

Implementation options:

- Generate a static ICS route for the event.
- Reuse existing `src/lib/ical.ts` patterns if compatible.

Do not build a calendar subscription feature for this tournament.

## Environment Variables

Add to `src/lib/env.ts`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` only if needed; Stripe Checkout redirect flow may not need it
- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`
- `GOLF_TOURNAMENT_ADMIN_EMAILS` or use configured Michelle/Jesse constants until admin emails are formalized
- `GOLF_TOURNAMENT_CONTACT_EMAIL`

Dev fallback policy:

- Stripe can be stubbed only while building UI.
- Test-mode Stripe is preferred for end-to-end verification.
- R2 can be stubbed locally for UI, but real private storage is required before launch if logo upload ships.

## Security / Privacy

- Do not store card data. Stripe owns all card handling.
- Store completion token hash, not raw token.
- Completion links are long random tokens, private-by-link, not indexed.
- CSV excludes completion tokens/links.
- Logo uploads are private by default.
- Public logo display requires admin approval.
- Validate file types and size on upload.
- Admin routes use existing auth and role gating.
- Webhook verifies Stripe signature.
- Webhook is idempotent to avoid duplicate emails/records.
- Do not include tax-deductible claims in public page, checkout text, receipts, or app emails unless BGSL provides exact approved language.

## Migration Plan

1. Add enums and new tables to `src/db/schema.ts`.
2. Run `pnpm db:generate`.
3. Review generated SQL for:
   - enum creation
   - table creation
   - unique indexes
   - foreign keys
4. Apply locally with `pnpm db:migrate`.
5. Seed optional local demo purchase/in-kind data only if helpful for admin UI development.

No existing data backfill required.

## Implementation Phases

### Phase 1 — Public page and config

- Add package config module.
- Build `/golf-tournament` responsive landing page using the `Fairway Fundraiser` design system.
- Add root redirect behavior.
- Add metadata/Open Graph support.
- Add sponsor wall shell.
- Add Add to Calendar route/action.
- Verify the public page reads as a local event invitation, not a SaaS pricing page.

### Phase 2 — Database and checkout

- Add schema/migration.
- Add Stripe env handling.
- Add checkout session creation.
- Add Stripe webhook.
- Add paid purchase creation/update flow.
- Add test-mode checkout verification.

### Phase 3 — Completion and uploads

- Add private completion token helper.
- Add completion page/form.
- Add player slot persistence.
- Add sponsor fields.
- Add R2 upload helper and asset metadata.
- Add buyer/admin emails.

### Phase 4 — Admin operations

- Add `/settings/golf-tournament` dashboard.
- Add filters, totals, fulfillment statuses.
- Add logo approval.
- Add completion-link resend.
- Add CSV export.
- Add in-kind submission admin status.

### Phase 5 — Launch hardening

- Connect BGSL-owned production Stripe account.
- Configure webhook in Stripe.
- Configure Cloudflare R2 bucket and keys.
- Confirm Michelle's public email, deadline, capacity, assets, and final copy.
- Run verification.
- Smoke-test full flow in Stripe test mode, then live mode with a low-value/test purchase if BGSL allows.

## Verification

No test runner is configured. Required checks:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Manual smoke tests:

1. Signed-out `/` redirects to `/golf-tournament`.
2. Signed-in `/` redirects to `/schedule`.
3. `/golf-tournament` renders on mobile and desktop.
4. Public design uses golf-forward local event language: fairway/flag/scorecard visual cues, restrained logo, event placards, and no SaaS pricing-page feel.
5. Mobile first screen shows event name, date, venue, and primary CTA without crowding.
6. Sold-out package displays disabled CTA.
7. Available package creates Stripe test Checkout Session.
8. Cancel returns to `/golf-tournament`.
9. Successful Stripe test payment triggers webhook and creates/updates paid purchase.
10. Buyer confirmation email includes completion link.
11. Completion form accepts phone, player names, sponsor details, included-golf intent.
12. Completion form can be edited again through same token.
13. Logo upload stores private file metadata and admin can view/download it.
14. Approved sponsor appears on public sponsor wall; unapproved sponsor does not.
15. In-kind form creates submission and sends admin notification.
16. Admin dashboard shows totals, statuses, filters, Stripe references, and CSV export.
17. CSV export excludes completion tokens/links.

## Launch Blockers

- BGSL-owned Stripe account and production keys
- Stripe webhook signing secret configured
- Cloudflare R2 bucket/keys configured if logo upload is live
- Inbox access for `mishlambert10@gmail.com`
- Registration/sponsorship deadline
- Course capacity/foursome cap
- Final sponsor package copy/counts
- Launch assets or generated OG fallback
- Decision on whether any tax/deductibility wording is approved beyond safe proceeds language
