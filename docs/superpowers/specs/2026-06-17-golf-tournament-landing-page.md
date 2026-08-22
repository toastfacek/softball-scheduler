# Tee Up for Beverly Girls Softball — Product Spec

## Goal

Create a public landing page on the existing Beverly Girls Softball League site for the inaugural BGSL golf tournament at Beverly Golf & Tennis Club.

The page should help local businesses, families, coaches, community supporters, sponsors, and golfers understand the event quickly and take the next step: register to golf, sponsor the tournament, donate a raffle prize, or contact BGSL.

This is a public marketing/fundraising page, separate from the private team-management app used by parents and coaches.

## Source

- Google Doc: `BGSL - Golf Tournament Sponsorship Opportunities`
- Shared by: Michelle Lambert
- Comments: none
- Known review note: the "Grab & Go Lunch Sponsor" section was colored red in the doc. Keep it in the plan unless Michelle says to remove it.

## Known Event Details

- Event name: `Tee Up for Beverly Girls Softball`
- Event: inaugural BGSL golf tournament
- Location: Beverly Golf & Tennis Club
- Date/time: Monday, September 28, 2026; registration begins at 9:00am and tournament play starts at 10:00am
- Format: scramble format
- Purpose: raise funds for BGSL programming, equipment, scholarships, field improvements, and opportunities for girls across Beverly to learn, compete, and grow through softball

## Route / Slug

Chosen route:

- `/golf-tournament`
- Full public URL: `https://beverlysoftball.com/golf-tournament`

Rejected options:

- `/summer-golf-tournament`
- `/summergolftourney`
- `/golf`
- `/events/golf-tournament`

Rationale: `/golf-tournament` is clear, easy to say out loud, readable on printed flyers, and not tied to a season name that may feel odd for a September event.

Distribution decision:

- Build and host the page on `beverlysoftball.com`
- During the off-season campaign window, make the `beverlysoftball.com` root redirect public visitors to `/golf-tournament`
- If a signed-in app user visits `/`, keep the existing behavior of redirecting them to `/schedule`
- Eventually update the existing `bgsl.net` / SportsPlus golf tournament link to point to `https://beverlysoftball.com/golf-tournament`
- Treat `bgsl.net` as a traffic source, not the primary experience
- Preserve private app routes for authenticated/admin users; do not remove the existing team-management app

## Audience

Primary audiences:

- Local businesses considering sponsorship
- Foursomes or individual organizers registering golfers
- BGSL families who can sponsor, golf, share, or donate raffle prizes

Secondary audiences:

- Coaches and volunteers who need a shareable reference page
- Community members learning why BGSL is fundraising

## Conversion Actions

The page should make these actions obvious:

1. Register a foursome
2. Sponsor the tournament
3. Donate a raffle prize or in-kind item
4. Contact BGSL with questions

Decision: registration and sponsorship CTAs should lead to a custom checkout flow that collects payment before a spot or sponsorship is considered claimed. BGSL should not accept unpaid signups as confirmed reservations.

## Required Content

### Hero

- `Tee Up for Beverly Girls Softball`
- Date, start time, location, and scramble format
- Short purpose statement tied to girls softball in Beverly
- Primary CTA
- Secondary CTA

### Event Details

- Monday, September 28, 2026
- 9:00am registration
- 10:00am tournament start
- Beverly Golf & Tennis Club
- Optional if confirmed: venue address and `Open in Maps` link
- Scramble format
- Plain-English explanation: each foursome plays as a team, choosing the best shot after each stroke, so the event is friendly for a range of skill levels
- Tournament activities:
  - Mulligans: $5 each or 5 for $20
  - 50/50 raffle
  - Raffle prizes and contest giveaways

### Event At A Glance

Include a simple schedule/timeline section using confirmed details only:

- 10:00 AM — Tournament start
- 9:00 AM — Registration/check-in
- Lunch — TBD
- Raffle / awards — TBD

Do not invent times. Fill in additional schedule details only after Michelle or the course confirms them.

Include a simple Add to Calendar action for the tournament date/time. Reuse existing calendar/ICS patterns from the app if practical; do not build a full calendar subscription feature for this event.

### Golfer Registration

- Golfers Registration Package — $640
- Includes green fees, cart fees, lunch, and registration for one foursome
- Public golfer registration is foursomes only; individual golfer registration is not offered in v1

### Sponsorship Opportunities

Decision: present packages by buyer intent rather than as one long price list.

Recommended public grouping:

- Play Golf
- Sponsor a Hole or Contest
- Sponsor the Tournament Experience
- Donate Raffle or In-Kind Prize

Rationale: sponsors and families scan by what they want to do, not only by price. Grouping by intent makes the page easier to understand and helps different supporter types find themselves quickly.

Price display rule:

- Show public package prices as whole dollars, such as `$640` or `$2,500`
- Do not show `.00` on the landing page

#### Play Golf

- Golfers Registration Package — $640
  - Green fees
  - Cart fees
  - Lunch
  - Registration for one foursome
  - Public registration is foursomes only

#### Sponsor a Hole or Contest

- Tee Box or Green Sponsor — $200
  - Logo/signage at one tee box or green
  - Recognition on BGSL social and website
- Closest to the Pin Contest Sponsor — $300
  - Two available: holes 6 and 15
  - Signage
  - Recognition
- Longest Drive Contest Sponsor — $300
  - One available: hole 17
  - Signage
  - Recognition
- Longest Marshmallow Drive Sponsor — $500
  - One available: hole 9
  - Signage
  - One player registration
  - Recognition

#### Sponsor the Tournament Experience

- Double Play Sponsor — $800
  - Signage at two tee boxes/greens
  - One twosome
  - Recognition
- Sunrise Breakfast Sponsor — $1,000
  - One available
  - Clubhouse breakfast station logo/materials
  - One twosome
  - Recognition
- Golf Cart Sponsor — $1,300
  - One available
  - Logo/QR in every golf cart
  - Premium cart placement
  - One twosome
  - Recognition
- Triple Play Sponsor — $1,600
  - Signage at three tee boxes/greens
  - One foursome
  - Recognition
- Grab & Go Lunch Sponsor — $2,200
  - One available
  - Promotional items in player cart lunch bags
  - One foursome
  - Recognition
  - Keep unless Michelle says to remove it
- Grand Slam Sponsor — $2,500
  - Two available
  - Sponsor gift bag for top two winning foursomes with branded swag, gift cards, coupons, or promotional items
  - Portion supports cash prizes
  - Signage at two tee boxes/greens
  - One foursome
  - Recognition

#### Donate Raffle or In-Kind Prize

- Raffle Prize Sponsor / In-Kind Donation
  - Gift card, product, service, or promotional item for raffle
  - Recognition during raffle announcements, on social, and on the website
  - Uses a no-payment form rather than Stripe Checkout

Raffle/in-kind form fields:

- Donor or business name
- Contact name
- Email
- Phone
- Item or service description
- Estimated value
- Pickup/drop-off notes

Rationale: raffle and in-kind supporters are contributing goods or services, not buying a fixed-price package. They should appear in the admin dashboard as in-kind submissions, but do not need payment checkout.

In-kind admin status:

- New
- Accepted
- Needs follow-up
- Declined

Rationale: BGSL should review in-kind submissions before treating them as confirmed raffle prizes or giveaways.

### Closing Copy

Thank sponsors and golfers for helping create opportunities for girls in the community to learn, compete, and grow through softball.

### FAQ

Include a compact FAQ section focused on questions that reduce purchase hesitation:

- What is scramble format?
- Do I need all four player names before paying?
- Can sponsors provide included golfer names later?
- What does my sponsorship support?
- Who do I contact with questions?
- Are raffle and in-kind donations accepted?

Keep FAQ answers short and plainspoken.

## Design Direction

The page should feel like a polished local event invitation: community-minded, golf-forward, sponsor-ready, and more human than a SaaS/product marketing page.

Design-system reference:

- Follow `docs/superpowers/specs/2026-06-17-bgsl-public-design-system.md`
- Use the `Fairway Fundraiser` direction from `docs/bgsl-public-design-system-preview.html`

Suggested direction:

- Mobile-first, because links will likely be shared by text, email, and social
- Golf-forward public palette: fairway green, mint, sand, sky, navy structure, and orange action accents
- Use Barlow Condensed display type and Sora body type from the current app
- Treat the BGSL logo as a small authenticity/proof mark, not the hero centerpiece
- Golf/event texture through fairway/flag/scorecard visual elements and real photography if available
- Sponsorship levels shown as punchy, mobile-friendly event placards grouped by buyer intent
- Strong sticky or repeated CTA sections so visitors do not have to scroll back to act
- Visual tone should be energetic and fundraiser-ready: local, polished, bold, and a little flashy without feeling generic or gimmicky
- Use scorecard-style fact rails, flyer-like section breaks, event-stamp details, and human community copy
- Avoid SaaS pricing-page patterns: overly rounded cards, generic icon grids, floating product sections, and sterile dashboard-like spacing

Important design caveat: because this is public and sponsor-facing, it should not look like the private app shell. It can share brand DNA while feeling more like a public event page.

Existing brand/site notes:

- BGSL has a SportsPlus-hosted site at `https://bgsl.net/`
- The public shell includes links for registration, schedules, sponsors, social accounts, online store, and an existing "BGSL Golf Tournament" nav item
- The existing golf tournament page currently returns access denied / not public
- Treat `bgsl.net` as a loose reference for league identity, not as the design system to copy
- Jesse reports BGSL has a logo and possibly a small set of candid photos, but the logo should not be featured heavily
- The existing doc/site design system is rudimentary; the new page should feel inspired by BGSL but not beholden to the current SportsPlus look

Asset plan:

- Use the BGSL logo sparingly as a small proof mark
- Use candid BGSL photos if quality and permissions are acceptable
- Use Beverly Golf & Tennis Club/course photos only if BGSL has permission
- If assets are limited, build a polished golf-forward event page first and drop in stronger photography later
- Include social sharing metadata for v1: title, description, and Open Graph image if an acceptable image is available
- If no strong image is available at build time, create/use a generated branded Open Graph fallback image and replace it later if better photography becomes available
- Branded fallback should include `BGSL Golf Tournament`, `Monday, September 28, 2026`, `Beverly Golf & Tennis Club`, golf-forward fairway/sand/sky visuals, and the BGSL logo only as a small proof mark

## Checkout / Payment Model

Chosen direction:

- Build a custom checkout flow for golfer registration and sponsorship purchases
- Require payment before confirming a foursome or sponsorship package
- Treat unpaid or abandoned checkouts as not reserved
- Count sponsorship inventory only after successful payment confirmation
- Support one package per checkout in v1
- Package card CTAs go directly to Stripe Checkout; do not add an intermediate review page in v1

Rationale: limited sponsorship inventory should not be soft-held by people who express interest but do not pay. Payment-first checkout gives BGSL cleaner records, fewer follow-up chores, and a more reliable view of what is actually sold.

Multiple-package purchase rule:

- V1 supports one paid package per checkout
- Buyers who want multiple packages can complete multiple checkouts or contact Michelle
- Admin dashboard may show multiple purchases from the same buyer/email

Inventory rule:

- Paid purchases count against package availability
- Started Stripe Checkout sessions do not reserve inventory
- Abandoned checkout sessions do not affect availability
- Sold-out packages should be hidden, disabled, or clearly marked as sold out before a buyer starts checkout
- After Stripe confirms payment, the app records the paid purchase and updates the sold count
- Rare conflict fallback: if two buyers pay for the final limited slot at nearly the same time, BGSL manually contacts the later buyer to offer an alternate package or refund

Rationale: temporary inventory holds would add complexity and are unlikely to matter for this local fundraiser. Successful payment is the cleanest definition of a confirmed purchase.

Sold-out display rule:

- Keep sold-out packages visible on the landing page
- Disable the purchase CTA and label the package `Sold out`
- For high-interest sold-out packages, optionally show `Contact us about similar options`
- Use real availability labels such as `1 available`, `2 available`, or `Sold out` for urgency
- Show exact counts when confirmed
- Use `Multiple available` or omit the count for packages whose true capacity is not confirmed, such as Tee Box or Green Sponsor
- For foursome registration, do not show remaining capacity publicly; show availability normally until sold out, then label as `Sold out`
- Do not use a live countdown timer in v1

Rationale: visible sold-out packages create social proof, prevent confusion when someone heard about a specific package, and can nudge buyers toward another sponsorship level.

Chosen payment implementation:

- Use Stripe Checkout for the first version
- Keep the BGSL landing page custom and polished, then redirect buyers to Stripe's hosted checkout page for payment
- Return buyers to BGSL after successful payment or cancellation
- Stub Stripe integration during early build if a BGSL Stripe account is not ready yet
- Prefer real Stripe test-mode checkout during development so purchase flow, webhook handling, admin dashboard, completion form, and emails can be verified end-to-end before live payments

Rationale: Stripe Checkout gives BGSL a reliable payment flow quickly, supports common card and wallet payment methods, avoids building a custom card form, and reduces operational risk for a first-time fundraiser.

Stripe setup status:

- BGSL Stripe account is not confirmed
- Jesse may need to create or connect a BGSL-owned Stripe account before payment launch
- Do not use Jesse's personal Stripe account for production payments

Stripe launch requirements:

- BGSL-owned Stripe account
- Connected BGSL bank account
- Stripe account business/tax identity completed
- Production API keys
- Webhook signing secret
- Success URL: `https://beverlysoftball.com/golf-tournament/complete/{token-or-session}`
- Cancel URL: `https://beverlysoftball.com/golf-tournament`
- Stripe Dashboard access for Jesse and any BGSL treasurer/admin who needs payment/reconciliation access
- Decide whether Stripe automatic receipts are enabled and what business name appears on receipts
- Test mode checkout verified before switching to live mode

Current Stripe standard U.S. fee schedule to account for in planning:

- Domestic cards: 2.9% + $0.30 per successful transaction
- Stripe Checkout: included with Stripe Payments on standard pricing
- Apple Pay / Google Pay through card rails: generally the same as card pricing
- International cards: +1.5%
- Currency conversion, if needed: +1%
- ACH Direct Debit: 0.8%, capped at $5.00, but not recommended for v1 because it settles more slowly and can create confirmation complexity
- Disputes: $15.00 dispute fee

Approximate domestic-card examples:

- $200 sponsor package: $6.10 fee; about $193.90 net
- $640 foursome: $18.86 fee; about $621.14 net
- $2,500 sponsor package: $72.80 fee; about $2,427.20 net

Fee handling decision:

- Buyers pay the listed package price
- Do not add an optional "cover processing fees" upsell in v1
- BGSL absorbs Stripe fees as part of the cost of online registration

Rationale: keeping checkout simple is more important than recovering a small additional amount per transaction for the first version.

Stripe Tax decision:

- Do not configure Stripe Tax or sales-tax calculation in v1
- Revisit only if BGSL's treasurer/accountant says tax calculation is required

Discount/comp decision:

- Do not support public discount codes, promo codes, or comped registrations in v1
- Any exceptional comp arrangement should be handled manually outside the public checkout flow

## Registration / Fulfillment Data

Decision: payment should lock in the purchase before operational details are collected. After payment, a public foursome registration is not complete until the organizer supplies all four player names on the private completion form.

Recommended model:

- Checkout collects the minimum required to pay and confirm the purchase
- Stripe provides buyer email and basic payment identity through the Checkout Session
- BGSL stores the purchase with a `needs_details` style status when player names, logo, or sponsor fulfillment details are still missing
- A post-payment confirmation page and/or email asks the buyer to complete missing details
- After successful payment, send the buyer directly to the private-by-link completion form
- The completion page should lead with confirmation language such as `You're confirmed. Help us finish your tournament details.`
- Buyers should receive both a Stripe receipt and a BGSL confirmation email
- The BGSL confirmation email should include the private completion link, package summary, `mishlambert10@gmail.com`, and safe proceeds language
- The BGSL confirmation email should not include tax-deductible claims unless approved language is provided later
- Tournament purchase and fulfillment notifications are email-only in v1; do not send SMS/text confirmations for public buyers

Completion-link lifetime:

- Private completion links remain editable through the tournament and for 30 days after the event
- After that window, forms can become read-only or closed
- Admins can resend, revoke, or regenerate a completion link if needed
- Buyers can revisit the private completion link and update details multiple times while the link is active
- Store update timestamps so admins can see when details were last changed

For all purchases, store:

- Buyer name
- Buyer email
- Buyer phone from the completion form
- Purchase type/package
- Amount paid
- Stripe Checkout Session ID
- Stripe PaymentIntent ID when available
- Payment status
- Fulfillment status

Phone collection rule:

- Keep Stripe Checkout as frictionless as possible
- Require buyer/contact phone on the post-payment completion form

For golfer registration packages:

- Require one primary foursome contact
- Collect and require all four player names after payment for public foursome registrations
- Sponsor-included golfer names remain flexible until the sponsor registration/comp workflow is finalized
- Final operational requirement: all four player names must be collected before the tournament
- Public registration is foursomes only
- Confirm total course capacity before launch and configure a max foursome/player-slot limit

For sponsorship packages that include golf registrations:

- Store the included golfer capacity:
  - One player registration
  - One twosome
  - One foursome
- Allow sponsors to pay before naming included golfers
- Ask whether the sponsor plans to use included golfer spots:
  - We will use the included spots
  - We do not plan to use the included spots
  - Not sure yet
- Follow up for player names and sponsor materials after payment

Rationale: some sponsors may want to support BGSL without sending golfers. The system should not force them to provide player names if they intend to decline or release the included spots.

For sponsors, collect after payment or through a lightweight follow-up form:

- Business/sponsor display name
- Sponsor contact name
- Website URL
- Logo/artwork
- Preferred recognition name
- Signage or promotional notes

Rationale: Michelle's operational need is real, but making names mandatory before payment may cause buyers to pause and never finish. The cleaner product rule is: payment confirms the spot; missing details become a follow-up task.

Pre-checkout data rule:

- Do not require sponsor/business name before payment in v1
- Keep checkout entry as simple as possible
- Use Stripe buyer identity/email as the initial purchase contact
- Collect sponsor/business display name and fulfillment details after payment on the completion form

## Logo / Asset Uploads

Decision: sponsors should be able to upload logos through the post-payment completion form. Uploaded assets should be private/admin-only by default.

Recommended storage:

- Cloudflare R2 bucket for tournament assets
- Example bucket: `bgsl-tournament-assets`
- Example object key: `golf-tournament/{year}/{purchaseId}/logo-original.{ext}`

Allowed upload types:

- `.png`
- `.jpg`
- `.jpeg`
- `.svg`
- `.pdf`

Recommended max size:

- 10 MB for v1

Visibility model:

- Uploaded logos are private by default
- Admins can review/download the submitted logo
- A separate `approved_for_public_display` style flag controls whether a sponsor logo appears publicly
- Public sponsor logos should only display after BGSL approves the sponsor name/logo

Optional public feature:

- Hide the sponsor wall until at least one tournament sponsor has been approved for public display
- Show only approved tournament sponsor names/logos; do not use league sponsors as placeholders
- When an approved sponsor has a website URL, open it in a new tab when the logo is selected
- This creates social proof and may encourage additional sponsors
- If no logos are approved yet, hide the section rather than showing an empty state
- In v1, show approved sponsor logos in one simple sponsor section, optionally with a small sponsorship-level label
- Do not create complex tiered logo sizing or ranking in v1

Cloudflare R2 planning note:

- R2's free tier is likely enough for this fundraiser: 10 GB-month storage, 1 million Class A operations, 10 million Class B operations, and free egress on standard storage
- Paid standard storage is currently $0.015 per GB-month after the free tier

## Admin Access

Decision: use the existing private BGSL app authentication and admin role for tournament administration. Do not create a separate tournament admin login.

Initial admins:

- Jesse
- Michelle Lambert

Recommended admin route:

- Private route behind existing app auth and admin authorization
- Likely `/settings/golf-tournament` or `/golf-tournament/admin`, with final placement based on implementation fit

Admin capabilities for v1:

- Dashboard/list of all purchases
- Summary totals:
  - Gross paid
  - Estimated Stripe fees
  - Estimated net
  - Purchase count by package
  - Remaining inventory
- Filters or tabs:
  - All
  - Golfers
  - Sponsors
  - Missing details
  - Approved public logos
- Buyer name, email, and phone
- Package purchased and amount paid
- Payment status
- Fulfillment status:
  - Paid / needs details
  - Details submitted
  - Needs review
  - Complete
- Player names if provided
- View/download uploaded logos and sponsor assets
- Approve/unapprove sponsor logos and sponsor names for public display
- Resend a buyer's completion-link email
- Export purchases/details to CSV
- Show Stripe payment/session reference or dashboard link for manual reconciliation

Rationale: the app already has admin auth and team roles. Reusing that model keeps the public buyer experience simple while giving BGSL a controlled private operations surface.

Purchase fulfillment statuses:

- `Paid / needs details`: payment is confirmed, but required golfer/sponsor details are missing
- `Details submitted`: buyer submitted the completion form
- `Needs review`: admin needs to review logo, sponsor display, or operational detail
- `Complete`: all required details are present and accepted

Refunds:

- No in-app refund tooling in v1
- Exceptional refunds are handled manually through the Stripe Dashboard
- The admin page should expose enough Stripe reference information to find the payment

Admin notifications:

- Send admin email notifications to Michelle and Jesse for:
  - Successful paid purchase
  - Completion/details form submitted or updated
  - Sponsor logo uploaded
- Public raffle/in-kind submissions pass through a deterministic abuse screen.
  Low-risk submissions are saved as `NEW` and emailed to Michelle only;
  high-confidence matches are saved as `NEEDS_FOLLOW_UP` with human-readable
  discard-review reasons and do not generate an email.
- The dashboard remains the source of truth; notifications are for awareness and follow-up speed

Financial reporting rule:

- Dashboard fee/net values are estimates for planning
- Stripe remains the source of truth for exact fees, payouts, disputes, and refunds

CSV export rule:

- CSV export is operational, not a security/admin-control artifact
- Include package, buyer/contact info, player names, sponsor details, logo status, payment status, and fulfillment status
- Exclude private completion tokens and completion links from CSV
- Admins resend completion links from the dashboard instead

## Data / Content Model

Recommended first version if using payment:

- Static public landing page in `src/app/golf-tournament/page.tsx`
- Checkout route or server action that creates paid registration/sponsorship sessions
- Database records for purchases, package type, buyer details, payment status, and sponsor fulfillment fields
- Sponsorship package inventory tracked so limited packages can sell out
- Package definitions, prices, included benefits, and capacity counts are developer-managed in v1, likely via code/config/database seed
- Admins can manage purchases, details, and logo approvals, but do not edit package prices or capacities in v1

This is more work than a pure landing page, but it matches the product requirement that people should not be able to reserve without paying.

Possible later version:

- Admin-editable sponsorship inventory and sold-out status
- Sponsor logo upload/display
- Refund/cancellation handling
- Automated sponsor-logo collection reminders
- General cash donations

Recommendation: keep the landing page content static, but make purchase records and inventory database-backed from the start.

General donation decision:

- Do not include a general cash donation option in v1
- Focus the page on foursome registration, sponsorship packages, and raffle/in-kind submissions

## Implementation Shape

Likely files:

- `src/app/golf-tournament/page.tsx` for the public landing page
- Optional `src/app/golf-tournament/layout.tsx` only if the page needs route-specific metadata or layout isolation
- Optional shared local components if the page gets large
- Public assets under `public/` if Jesse/Michelle provide logos or images

The current `src/app/page.tsx` redirects unauthenticated visitors to `/sign-in`. For this campaign, update root behavior so signed-out/public visitors redirect to `/golf-tournament`, while signed-in app users continue to redirect to `/schedule`.

## Risks / Things To Decide

- **Payment flow:** Taking money online changes the project from "landing page" into "checkout/registration system." That is intentional for this project because BGSL does not want unpaid reservations, but it adds payment, confirmation emails, and admin reconciliation decisions.
- **Sponsor availability:** Static "one available" copy is easy; live availability requires someone to update it accurately.
- **Inventory conflicts:** If two people submit for the same one-available package, BGSL needs a rule: first paid, first confirmed, or manually approved.
- **Course capacity:** Total foursome/player-slot capacity is not known yet. This is not a design blocker, but must be confirmed before launch to avoid overselling.
- **Registration/sponsorship deadline:** Unknown; Jesse will confirm with Michelle before launch.
- **Date clarity:** Confirmed as Monday, September 28, 2026.
- **Assets:** Real BGSL or course images will make the page feel much more credible than generic golf visuals.
- **Grab & Go Lunch Sponsor:** Keep in the build unless Michelle says to remove it; source-doc red styling is noted but not treated as a blocker.
- **Tax / deductibility language:** Public sources list Beverly Girls Softball Inc as a 501(c)(3) public charity, but checkout/page language should not claim purchases are tax-deductible unless BGSL provides approved wording. Sponsorships that include golf, lunch, recognition, or promotional value may require more precise language.
- **Contact routing:** Use `mishlambert10@gmail.com` for public and operational tournament messages.

Tax language decision:

- Public page, Stripe checkout metadata/description, confirmation emails, and receipts should use safe proceeds language only
- Do not claim that purchases or sponsorships are tax-deductible in v1
- Use: `Proceeds support Beverly Girls Softball League programming, equipment, scholarships, field improvements, and opportunities for girls across Beverly.`
- Add tax-deductible language only if BGSL provides exact approved wording

Contact decision:

- Use `mishlambert10@gmail.com` for public questions, raffle/in-kind responses, and initial tournament notifications
- Show `mishlambert10@gmail.com` directly on the public page
- Jesse owns the `beverlysoftball.com` email domain but has not set up an inbox yet
- Future recommendation: create `golf@beverlysoftball.com` or `tournament@beverlysoftball.com` as a forwarding alias to Michelle and Jesse
- A future `@beverlysoftball.com` alias can replace or forward to this inbox without changing the public workflow

Sponsor registration/comp decision:

- Do not expose public discount or promo codes
- Add a backend-only workflow for admins to record sponsor golfers and exceptional arrangements, such as registering four players while collecting payment for three
- Keep an audit trail of the standard package amount, actual amount charged, reason, and admin responsible
- Until that workflow is implemented, handle exceptional sponsor arrangements manually and reconcile them in Stripe/admin notes

## Remaining Open Items

1. Registration/sponsorship deadline
2. Total course capacity: max foursomes and/or max player slots
3. Whether Grab & Go Lunch Sponsor stays or gets removed
4. Exact nonprofit/tax-deductibility wording, if BGSL wants anything beyond safe proceeds-only language
5. BGSL-owned Stripe account setup and production keys
9. Cloudflare R2 bucket/account details for private logo uploads

## Michelle Follow-Up Checklist

Use this checklist before launch:

- Confirm inbox access for `mishlambert10@gmail.com`
- Confirm registration/sponsorship deadline
- Confirm total course capacity: max foursomes and/or max player slots
- Confirm whether Grab & Go Lunch Sponsor stays in the package list
- Confirm sponsor package names, prices, included benefits, and availability counts
- Confirm who should receive admin notification emails
- Confirm available assets: BGSL logo, candid photos, course photos, tournament artwork
- Confirm whether BGSL has approved nonprofit/tax-deductibility wording, or whether to keep safe proceeds-only language
- Confirm whether BGSL already has a Stripe account, or whether Jesse needs to create/connect one

## Acceptance Criteria

Before implementation is considered complete:

- Public URL loads without requiring sign-in
- Root URL sends signed-out visitors to `/golf-tournament`, while signed-in users still reach `/schedule`
- Page is responsive and polished on mobile and desktop
- Public design follows `Fairway Fundraiser`: golf-forward local event page, restrained BGSL logo, scorecard/event placard texture, and no SaaS pricing-page feel
- Event basics are visible in the first screen: name, date, time, location, and primary CTA
- Golfer registration package is easy to find
- Sponsorship opportunities are complete, accurate, and scannable
- Raffle/in-kind donation option is included
- Package CTAs create Stripe Checkout sessions in test mode during development
- Successful Stripe payment creates a purchase record and sends buyer to the completion form
- Buyer receives Stripe receipt and BGSL confirmation email
- Admin notifications are sent for purchase/detail/logo events and for
  in-kind submissions that pass the deterministic abuse screen
- Admin dashboard supports purchase review, fulfillment statuses, logo approval, completion-link resend, CSV export, and estimated totals
- Private logo upload stores files in Cloudflare R2 or an equivalent configured private storage bucket
- Page metadata is set for sharing: title, description, and social preview if assets are available
- No changes break the private team app
- Verification passes: `pnpm typecheck && pnpm lint`

## Suggested Build Phases

### Phase 1 — Spec and launch inputs

- Confirm Michelle checklist items, assets, Stripe setup, R2 setup, and final package copy
- Finalize page copy

### Phase 2 — Static public landing page

- Build the route and responsive design
- Add metadata
- Add package cards, FAQ, sponsor wall shell, add-to-calendar, and root redirect behavior
- Verify on mobile and desktop

### Phase 3 — Checkout, completion, and admin operations

- Add Stripe Checkout in test mode
- Add database-backed purchases, inventory, in-kind submissions, completion tokens, and fulfillment statuses
- Add post-payment completion form and private logo upload
- Add BGSL confirmation/admin notification emails
- Add admin dashboard and CSV export

### Phase 4 — Launch hardening

- Connect production Stripe account and webhook
- Configure Cloudflare R2
- Confirm Michelle's public email, deadline, capacity, and assets
- Run `pnpm typecheck && pnpm lint`
- Smoke-test full test-mode checkout, completion, upload, admin approval, and CSV export
