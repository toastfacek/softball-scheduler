# BGSL Public Website Design System

## Purpose

Create a clean, modern, sponsor-ready visual system for public BGSL web pages, starting with the golf tournament landing page.

This system should feel more polished than the current SportsPlus `bgsl.net` site, more public-facing than the private `beverlysoftball.com` app shell, and more memorable than a generic nonprofit fundraiser page.

Working direction:

> Classic softball energy, country-club polish, Beverly community warmth.

## Reference Inputs

### `bgsl.net`

Useful signals:

- Official BGSL softball logo
- Bright softball yellow
- Red softball stitching
- Black varsity lettering
- Legacy community-sports feeling
- Existing public-site content: registration, schedules, sponsors, store, social links

Do not copy:

- SportsPlus layout clutter
- Dense nav/header structure
- Generic platform widgets
- Black-heavy background treatment as the main look
- Access-denied/public-private weirdness

### `beverlysoftball.com`

Useful signals:

- Existing navy/orange palette
- Barlow Condensed display font
- Sora body font
- Warm paper/panel background
- Rounded but practical app controls
- Mobile-first polish

Do not copy directly:

- Private app shell
- Auth-card visual language
- Dense coach/admin layout
- App-navigation patterns for public marketing pages

## Brand Personality

The public site should feel:

- Confident
- Local
- Energetic
- Sporty
- Trustworthy
- Modern
- A little flashy, but not gimmicky
- Sponsor-worthy
- Like a real community event invitation

It should not feel:

- Like SportsPlus
- Like a generic school fundraiser
- Like a private admin app
- Like SaaS pricing/marketing software
- Like a luxury golf club trying too hard
- Like stock-photo corporate charity

## Design Thesis

BGSL has three visual worlds:

1. The softball logo: yellow, red stitching, black varsity type, league history.
2. The app brand: navy, orange, warm paper, modern mobile UI.
3. The golf tournament: fairway greens, sand, sky, flags, scorecards, and sponsor polish.

The public website should bridge them without letting the current logo dominate:

- Use navy as the trust/structure color.
- Use golf greens, sand, and sky as the public-event atmosphere.
- Use orange as the primary action color.
- Use softball yellow only as a small heritage accent.
- Use red stitching very sparingly, if at all.
- Use the BGSL logo as a proof mark, not the hero image.

The result should feel like a polished golf fundraiser that happens to be powered by BGSL, not a page built around the legacy softball logo.

## Core Visual Direction

Name:

- **Fairway Fundraiser**

Short description:

- A modern public-event system with fresh course color, warm community texture, and polished sponsor hierarchy.

What someone should remember:

- Big condensed headlines, crisp navy structure, fairway/sand/sky color, and elegant sponsor cards that feel built for this event.
- Local-event texture: scorecard rails, flyer-like section breaks, event-stamp details, and human community copy.

## Color System

### Primary Tokens

Use OKLCH tokens for implementation, keeping close to the current app but adding public-site accents.

```css
:root {
  --bgsl-ink: oklch(0.19 0.01 40);
  --bgsl-navy: oklch(0.29 0.012 40);
  --bgsl-paper: oklch(0.975 0.008 84);
  --bgsl-card: oklch(0.99 0.005 84);
  --bgsl-line: oklch(0.84 0.012 82);

  --bgsl-orange: oklch(0.74 0.17 58);
  --bgsl-orange-strong: oklch(0.65 0.17 50);

  --bgsl-softball: oklch(0.89 0.15 96);
  --bgsl-stitch: oklch(0.55 0.18 30);

  --golf-fairway: oklch(0.43 0.105 150);
  --golf-green: oklch(0.53 0.13 145);
  --golf-mint: oklch(0.91 0.07 145);
  --golf-sand: oklch(0.86 0.055 78);
  --golf-sky: oklch(0.83 0.055 215);
}
```

### Color Roles

- **Navy / ink:** page headers, large type, footer, trust-heavy sections
- **Paper:** primary page background
- **Golf green / fairway:** hero visuals, section atmosphere, featured cards
- **Sand / sky:** supporting background color and light event texture
- **Orange:** primary CTA, active states, heat/energy moments
- **Softball yellow:** small heritage accent, social preview detail, never the main mood
- **Red stitch:** optional micro-accent only, never a large fill

### Palette Guardrails

- Do not make the page a generic country-club green template; use green with navy/orange tension.
- Do not make the page mostly yellow; use yellow as punch.
- Do not use purple/blue gradients.
- Do not use dark-mode neon.
- Do not rely on gray; tint neutrals toward warm paper/navy.

## Typography

Keep the current font pairing:

- Display: **Barlow Condensed**
- Body: **Sora**

Rationale:

- Barlow Condensed gives public pages a sports-poster quality without importing a novelty varsity font.
- Sora keeps forms, pricing cards, and admin-adjacent details modern and readable.

### Type Scale

```css
--type-kicker: 0.72rem;
--type-body: 1rem;
--type-lead: clamp(1.05rem, 1vw + 0.9rem, 1.3rem);
--type-card-title: clamp(1.5rem, 1.4vw + 1rem, 2rem);
--type-section: clamp(2.4rem, 4vw, 4.8rem);
--type-hero: clamp(4rem, 12vw, 10rem);
```

### Type Rules

- Use uppercase micro-labels sparingly.
- Use big compressed headlines for public impact.
- Keep body copy calm and direct.
- Avoid negative letter spacing beyond very small tightening in display type.
- Do not use novelty varsity fonts in the UI. The logo already provides that flavor.

## Logo Usage

The BGSL softball logo is visually loud, and Jesse does not want it featured heavily. Treat it as a small authenticity/proof mark, not the centerpiece.

Good uses:

- Footer mark
- Social preview image
- Small header mark with generous breathing room
- Small proof mark in the hero or footer if needed

Avoid:

- Repeating the logo as wallpaper
- Cropping it awkwardly
- Placing it on busy yellow backgrounds
- Making it compete with sponsor logos
- Making it the main hero visual

## Layout System

### Public Page Structure

Use full-width bands with constrained content. Avoid nested cards.

The public event page should be less SaaS and more local invitation:

- Prefer poster-like bands over floating product sections.
- Prefer scorecard/flyer details over dashboard widgets.
- Use a few crisp rectangular placards instead of many rounded SaaS cards.
- Let event facts, day-of activities, and community purpose interrupt the package grid.

Recommended max widths:

- Text/narrative content: `760px`
- Page content: `1180px`
- Wide sponsor/package grids: `1280px`

### Page Rhythm

Use varied spacing:

- Hero: tall and immersive
- Event facts: tight and scannable
- Sponsorship cards: dense but punchy
- Story/purpose section: more breathing room
- FAQ: compact
- Footer/contact: direct

Suggested section spacing:

```css
--space-section-sm: clamp(2.5rem, 5vw, 4rem);
--space-section: clamp(4rem, 8vw, 7rem);
--space-section-lg: clamp(5rem, 10vw, 9rem);
```

### Mobile First

Mobile should feel like the primary design, not a shrunken desktop page.

Rules:

- Pricing cards stack cleanly.
- CTAs are thumb-friendly.
- Event facts appear before long story copy.
- No giant desktop-only visual tricks that disappear on mobile.
- Sticky bottom CTA is allowed if it does not cover content.

## Components

### Hero

Purpose:

- Make the tournament feel real, local, and worth paying for.

Structure:

- Top mini-brand row with logo and `Beverly Girls Softball League`
- Oversized headline: `BGSL Golf Tournament`
- Event fact rail: date, time, venue, scramble format
- Primary CTA: `Register or Sponsor`
- Secondary CTA: `View Sponsorships`
- Visual layer: golf flag, fairway shape, scorecard/pin detail, course photo if available; logo only as a quiet proof mark

Style:

- Light paper or warm off-white base
- Strong navy headline
- Golf-forward green/sand/sky atmosphere
- Orange CTA
- No generic gradient hero
- No card containing the hero headline

### Fact Rail

Use compact pills or a tight horizontal/stacked list.

Fields:

- Monday, September 28, 2026
- 10:00 AM
- Beverly Golf & Tennis Club
- Scramble format

Style:

- Navy text
- Fine warm borders
- Small yellow/orange markers
- Not too rounded

### Package Cards

Purpose:

- Sell one package quickly.
- Feel like event placards, not SaaS pricing tiles.

Structure:

- Category label
- Package name
- Price
- Availability
- 3-5 benefit bullets
- Included golf indicator if applicable
- CTA

Style:

- Border radius: 0-8px; square/placard edges are preferred for the public event page
- Strong top typography
- Price large but not louder than the package name
- Yellow/orange accent strip or corner tag
- Sold-out state remains visible and disabled
- Featured package can use a richer yellow treatment
- Subtle print/flyer details are welcome: offset shadows, rule lines, tags, or stamp-like labels

Avoid:

- Identical generic card grid
- Big decorative icons on every card
- Too much shadow
- Nested cards

### CTA Buttons

Primary:

- Orange fill
- Navy/ink text
- Heavy font weight
- Slight press/hover motion

Secondary:

- Navy outline or text button
- Underline/arrow treatment

Disabled:

- Muted warm paper background
- Clear `Sold out` label
- No hover lift

### Sponsor Wall

Purpose:

- Show momentum and credibility.

Rules:

- Only approved sponsors appear.
- Hide section if empty.
- One simple grid in v1.
- Optional sponsorship-level label.
- Keep logo containers quiet and equal.

Style:

- White/paper logo field
- Thin warm border
- No huge tier hierarchy in v1

### Forms

Forms should feel lighter than the private app, but reuse familiar input clarity.

Rules:

- Labels above inputs
- Required fields obvious
- Large touch targets
- Helpful upload states
- Clear success states

Tone:

- `You're confirmed. Help us finish your tournament details.`
- `You can come back to this link later.`
- `Upload your logo or send it later.`

### Admin Dashboard

Use the existing private app visual language, not the public marketing system.

Reason:

- Admins need utility and consistency.
- Public pages need marketing polish.

Bridge:

- Admin can use tournament-specific chips/status colors, but stay inside the app shell.

## Visual Motifs

Use motifs sparingly and purposefully:

- Softball stitch curve as a section divider or subtle hero element
- Scorecard-like rows for event facts
- Pennant/ribbon tags for availability
- Clubhouse-style sponsor cards
- Small diamond/field geometry in backgrounds

Avoid:

- Decorative balls everywhere
- Golf clip art
- Random crossed bats/clubs
- Heavy texture backgrounds under body text

## Motion

Motion should be confident and subtle.

Use:

- Hero elements fade/slide in with stagger
- Package cards lift slightly on hover
- CTA press state
- Sponsor logos fade in as section enters
- Form upload progress/status feedback

Avoid:

- Bounce easing
- Constant animations
- Spinning golf balls
- Layout-shifting hover states

Motion timing:

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--duration-fast: 160ms;
--duration-med: 280ms;
--duration-slow: 520ms;
```

Respect `prefers-reduced-motion`.

## Imagery

Priority:

1. Real BGSL candid photos
2. Real Beverly Golf & Tennis Club/course photos with permission
3. BGSL logo and generated branded graphics
4. Carefully generated Open Graph image

Avoid:

- Generic stock golf photos
- Dark cropped atmosphere where the actual event is invisible
- Overly staged corporate sponsor imagery

Image treatment:

- Slight warm tint
- Crisp crops
- Simple navy/yellow caption tags if needed
- Do not blur images as a design crutch

## Open Graph / Social Preview

If no strong photo exists, create a branded fallback.

Content:

- BGSL logo
- `BGSL Golf Tournament`
- `Monday, September 28, 2026`
- `Beverly Golf & Tennis Club`
- Navy/orange/yellow palette
- Optional stitch curve

Visual direction:

- Bold, readable, local
- Not a flyer crammed with every detail

## Accessibility

Rules:

- Maintain contrast on yellow/orange.
- Use navy/ink text on yellow, not white.
- Do not put small text over photos.
- Buttons must have visible focus states.
- Forms must have real labels.
- Do not rely on color alone for sold-out/availability status.

## Implementation Notes

### CSS Strategy

Add a public-site layer rather than forcing everything through private app classes.

Recommended:

- Keep global tokens in `src/app/globals.css`.
- Add route-specific classes for public pages, prefixed with `public-` or `golf-`.
- Keep admin dashboard inside existing app shell styles.

Example:

```css
.public-page {
  --page-bg: var(--bgsl-paper);
  --page-ink: var(--bgsl-ink);
  background: var(--page-bg);
  color: var(--page-ink);
}

.golf-package-card {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--bgsl-navy) 14%, white);
  background: var(--bgsl-card);
}
```

### Component Naming

Suggested components:

- `GolfHero`
- `GolfFactRail`
- `GolfPackageSection`
- `GolfPackageCard`
- `GolfSponsorWall`
- `GolfFaq`
- `GolfCompletionForm`
- `GolfLogoUpload`

## Design QA Checklist

Before calling a page polished:

- Mobile first screen shows event name, date, location, and CTA.
- The BGSL logo feels intentional, not pasted on.
- Package cards are scannable in under 10 seconds.
- Orange/yellow accents feel energetic, not chaotic.
- No section looks like the private app dashboard.
- No generic stock look.
- Sold-out states are visible and understandable.
- Sponsor logos do not overwhelm the page.
- Text does not overflow on small screens.
- Social preview looks good in a message thread.

## One-Sentence North Star

BGSL public pages should feel like a polished Beverly golf fundraiser with BGSL heart in the background: fresh enough to excite families, credible enough for sponsors, and clean enough to make paying easy.
