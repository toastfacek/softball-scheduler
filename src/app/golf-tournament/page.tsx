import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { and, count, eq } from "drizzle-orm";

import {
  createGolfCheckoutSessionAction,
  submitGolfInKindDonationAction,
} from "@/actions/golf-tournament-actions";
import { db } from "@/db";
import {
  golfTournamentAssets,
  golfTournamentPurchases,
} from "@/db/schema";
import { isDatabaseConfigured } from "@/lib/env";
import {
  GOLF_TOURNAMENT_ADDRESS,
  GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED,
  GOLF_TOURNAMENT_SAFE_PROCEEDS,
  GOLF_TOURNAMENT_TITLE,
  GOLF_TOURNAMENT_VENUE,
  golfTournamentContactEmail,
} from "@/lib/golf-tournament/event";
import { golfInventoryCommitmentCondition } from "@/lib/golf-tournament/inventory";
import {
  formatGolfPackagePrice,
  getGolfTournamentPackage,
  golfPackageCategories,
  golfTournamentPackages,
  includedGolfSlotCount,
  isGolfEntryClosedForPackage,
  requiresGolfPlayerNames,
} from "@/lib/golf-tournament/packages";
import { GolfCheckoutButton } from "./golf-checkout-button";

const GOLF_REGISTRATION_CLOSED_MESSAGE =
  "We’ve filled every registration spot for this year’s tournament—thank you for the incredible support! Sponsorship opportunities remain available for businesses and community partners who’d still like to be part of the day.";

export const metadata: Metadata = {
  title: GOLF_TOURNAMENT_TITLE,
  description:
    GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED
      ? "Support the inaugural Beverly Girls Softball League golf tournament through sponsorships and raffle donations."
      : "Register or sponsor the inaugural Beverly Girls Softball League golf tournament at Beverly Golf & Tennis Club on Monday, September 28, 2026.",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  alternates: {
    canonical: "https://www.beverlysoftball.com/",
  },
  openGraph: {
    title: GOLF_TOURNAMENT_TITLE,
    description:
      "Golf, sponsorships, raffles, and community support for Beverly Girls Softball League.",
    url: "https://www.beverlysoftball.com/",
    siteName: "Beverly Girls Softball League",
    images: [
      {
        url: "https://www.beverlysoftball.com/golf-tournament/course-images/beverly-club-hero.jpg",
        width: 1920,
        height: 797,
        alt: "Beverly Golf and Tennis Club course",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: GOLF_TOURNAMENT_TITLE,
    description:
      "Golf, sponsorships, raffles, and community support for Beverly Girls Softball League.",
    images: [
      "https://www.beverlysoftball.com/golf-tournament/course-images/beverly-club-hero.jpg",
    ],
  },
};

type GolfTournamentPageProps = {
  searchParams?: Promise<{
    checkout?: string;
    inKind?: string;
  }>;
};

const confirmedSponsors = [
  {
    name: "Cross Insurance",
    logo: "/golf-tournament/sponsor-logos/cross-insurance.jpg",
  },
  {
    name: "Todd’s Sporting Goods",
    logo: "/golf-tournament/sponsor-logos/todds-upscaled.png",
  },
  {
    name: "REV Kitchen",
    logo: "/golf-tournament/sponsor-logos/rev-kitchen.png",
  },
  {
    name: "REV Burger",
    logo: "/golf-tournament/sponsor-logos/revburger.png",
  },
  {
    name: "Corner Butcher",
    logo: "/golf-tournament/sponsor-logos/corner-butcher.svg",
  },
  {
    name: "Ulrich Landscape",
    logo: "/golf-tournament/sponsor-logos/ulrich-landscape-logo-light.png",
    outlineLogo: true,
  },
  {
    name: "Sudbay Automotive",
    logo: "/golf-tournament/sponsor-logos/sudbay-automotive.png",
  },
  {
    name: "Port Lighting",
    logo: "/golf-tournament/sponsor-logos/port-lighting.png",
  },
  {
    name: "King & Wallin Family McDonald’s",
    logo: "/golf-tournament/sponsor-logos/mcdonalds.png",
  },
  {
    name: "Greater Beverly YMCA",
    logo: "/golf-tournament/sponsor-logos/greater-beverly-ymca.png",
  },
  {
    name: "Boston Crawling",
    logo: "/golf-tournament/sponsor-logos/boston-crawling.png",
  },
  {
    name: "Cabot Wealth Management",
    logo: "/golf-tournament/sponsor-logos/cabot-wealth-management.jpg",
  },
  {
    name: "At Home With Diantha",
    logo: "/golf-tournament/sponsor-logos/at-home-with-diantha.png",
  },
  {
    name: "Anchor Pub & Grille",
    logo: "/golf-tournament/sponsor-logos/anchor-pub-grille.png",
  },
  {
    name: "Axcelis Technologies",
    logo: "/golf-tournament/sponsor-logos/axcelis.png",
  },
  {
    name: "Full Count Fastpitch",
    logo: "/golf-tournament/sponsor-logos/full-count-fastpitch.png",
  },
  {
    name: "Cornerstone Financial Partners",
    logo: "/golf-tournament/sponsor-logos/cornerstone-financial-partners.jpg",
  },
  {
    name: "Witch City Plumbing & Heating",
    logo: "/golf-tournament/sponsor-logos/witch-city-plumbing-heating.jpg",
  },
] as const;

function formatGolfPackageDisplayName(
  item: (typeof golfTournamentPackages)[number],
) {
  if (item.kind !== "SPONSORSHIP") {
    return item.name;
  }

  return item.name.replace(/\s+Sponsor$/, "");
}

export default async function GolfTournamentPage({
  searchParams,
}: GolfTournamentPageProps) {
  const params = (await searchParams) ?? {};
  const contactEmail = golfTournamentContactEmail();
  const [approvedSponsors, soldCounts] = isDatabaseConfigured()
    ? await Promise.all([listApprovedSponsors(), listGolfPackageSoldCounts()])
    : [[], new Map<string, number>()];

  return (
    <main className="golf-page">
      <div className="golf-hero-stage">
        <header className="golf-topbar golf-wrap">
          <Link href="/" className="golf-brand" aria-label="BGSL home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="golf-brand-logo"
              src="/golf-tournament/league-images/bgsl-logo.png"
              alt=""
            />
            <span>Beverly Girls Softball League</span>
          </Link>
          <nav className="golf-nav" aria-label="Golf tournament navigation">
            <a href="#event">Event</a>
            <a href="#sponsorships">Sponsorships</a>
            <a href="#raffle">Raffle</a>
            <a href="#faq">FAQ</a>
            <a
              className="golf-nav-cta"
              href={GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED ? "#sponsorships" : "#packages"}
            >
              {GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED ? "Sponsor" : "Register"}
            </a>
          </nav>
        </header>

        <GolfNotice
          checkout={params.checkout}
          inKind={params.inKind}
          contactEmail={contactEmail}
        />
        {GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED ? (
          <div className="golf-wrap golf-alert" role="status">
            {GOLF_REGISTRATION_CLOSED_MESSAGE}
          </div>
        ) : null}

        <section className="golf-hero golf-wrap">
          <div className="golf-hero-copy">
            <h1>{GOLF_TOURNAMENT_TITLE}</h1>
            <p className="golf-lead">
              Join us for Beverly’s inaugural BGSL golf tournament. Play, sponsor,
              and help create more opportunities for girls across Beverly.
            </p>
            <div className="golf-actions">
              <a
                className="golf-button golf-button-primary"
                href={GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED ? "#sponsorships" : "#packages"}
              >
                {GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED ? "View Sponsorships" : "Register or Sponsor"}
              </a>
              <a className="golf-button golf-button-secondary" href="#raffle">
                Donate a Raffle Prize
              </a>
            </div>
          </div>
          <div className="golf-hero-art" aria-hidden="true">
            <div className="golf-tournament-card">
              <strong className="golf-tournament-date">September 28</strong>
              <em>Registration 9 AM · Tee off 10 AM</em>
            </div>
          </div>
        </section>
      </div>

      <section className="golf-scoreboard golf-wrap" aria-label="Tournament details">
        <div className="golf-fact">
          <span>Date</span>
          <strong>Monday, Sep. 28, 2026</strong>
        </div>
        <div className="golf-fact">
          <span>Schedule</span>
          <strong>Registration 9:00 AM · Start 10:00 AM</strong>
        </div>
        <div className="golf-fact">
          <span>Venue</span>
          <strong>{GOLF_TOURNAMENT_VENUE}</strong>
        </div>
        <div className="golf-fact">
          <span>Format</span>
          <strong>Scramble</strong>
        </div>
      </section>

      <section className="golf-band golf-wrap" id="event">
        <div className="golf-event-story">
          <div className="golf-event-copy">
          <h2>Golf, community, and giving back.</h2>
            <div className="golf-doc-copy">
              <p>
                {GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED
                  ? "We’ve filled every registration spot for this year’s tournament—thank you for the incredible support! You can still support hundreds of players and families by sponsoring the tournament or donating a raffle prize."
                  : "Whether you’re sponsoring a contest hole, registering a foursome, or partnering as a premier event sponsor, your support directly impacts hundreds of players and families in our community while putting your business in front of a highly engaged local audience."}
              </p>
              <p>
                We are proud to celebrate the businesses and community partners
                who continue to show up for girls sports in Beverly.
              </p>
            </div>
          </div>
          <div className="golf-event-media" aria-label="Beverly Girls Softball League moments">
            <div className="golf-course-photo golf-league-photo-main" />
          </div>
        </div>
        <div className="golf-poster-strip" aria-label="Tournament highlights">
          <div className="golf-poster-note">
            <strong>{GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED ? "Thank you for your support" : "Play as a team"}</strong>
            <span>
              {GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED
                ? "We’ve filled every registration spot; sponsorships and raffle donations remain open."
                : "Register a foursome or twosome."}
            </span>
          </div>
          <div className="golf-poster-note">
            <strong>Support the league</strong>
            <span>
              Your support helps fund programming, equipment, scholarships,
              field improvements, and opportunities for girls across Beverly.
            </span>
          </div>
          <div className="golf-poster-note">
            <strong>Day-of extras</strong>
            <span>
              Mulligans, 50/50 raffle, raffle prizes, contest giveaways, and
              sponsor recognition throughout the day.
            </span>
          </div>
        </div>
      </section>

      <section
        className="golf-packages-banner"
        id="packages"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(7, 25, 17, 0.24), rgba(7, 25, 17, 0.82)), url("/golf-tournament/course-images/beverly-club-hero.jpg")',
          backgroundPosition: "center",
        }}
      >
        <div className="golf-wrap golf-photo-banner-inner">
          <div>
            <h2>
              {GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED
                ? "Support the tournament."
                : "Secure your place on the course."}
            </h2>
          </div>
        </div>
      </section>

      <section className="golf-band golf-wrap golf-packages-list">

        <div className="golf-package-sections">
          {golfPackageCategories.map((category) => {
            const packages = golfTournamentPackages.filter(
              (item) => item.category === category.id,
            );

            return (
              <section
                key={category.id}
                className="golf-package-group"
                id={category.id === "HOLE_OR_CONTEST" ? "sponsorships" : undefined}
              >
                <div className="golf-package-group-head">
                  <h3>{category.label}</h3>
                  <p>
                    {GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED &&
                    category.id === "PLAY_GOLF"
                      ? "We’ve filled every registration spot for this year’s tournament. Sponsorship opportunities remain available."
                      : category.description}
                  </p>
                </div>
                <div className="golf-package-grid">
                  {packages.map((item) => {
                    const soldCount = soldCounts.get(item.id) ?? 0;
                    const remaining =
                      item.capacity === null
                        ? null
                        : Math.max(item.capacity - soldCount, 0);
                    const isSoldOut = remaining === 0;
                    const isEntryClosed = isGolfEntryClosedForPackage(item);

                    return (
                      <article
                        key={item.id}
                        className={[
                          "golf-package",
                          item.featured ? "golf-package-featured" : null,
                          isSoldOut || isEntryClosed
                            ? "golf-package-sold-out"
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                      <div className="golf-package-topline">
                        <span>
                          {isSoldOut
                            ? "Sold out"
                            : isEntryClosed
                              ? "Registration closed"
                              : item.availability}
                        </span>
                      </div>
                      <div className="golf-package-identity">
                        {item.locationLabel ? (
                          <span className="golf-package-location">
                            {item.locationLabel}
                          </span>
                        ) : null}
                        <h4>{formatGolfPackageDisplayName(item)}</h4>
                      </div>
                      {remaining !== null ? (
                        <div
                          className="golf-availability-marker"
                          aria-label={
                            isSoldOut
                              ? "Sold out"
                              : `${remaining} ${remaining === 1 ? "spot" : "spots"} remaining`
                          }
                        >
                          <strong>{isSoldOut ? "Fully" : remaining}</strong>
                          <span>
                            {isSoldOut
                              ? "claimed"
                              : remaining === 1
                                ? "spot left"
                                : "spots left"}
                          </span>
                        </div>
                      ) : null}
                      <p className="golf-price">
                        {formatGolfPackagePrice(item.priceCents)}
                      </p>
                      <ul>
                        {item.benefits.map((benefit) => (
                          <li key={benefit}>{benefit}</li>
                        ))}
                      </ul>
                      {isEntryClosed ? (
                        <button
                          className="golf-package-action"
                          type="button"
                          disabled
                          aria-label={`${formatGolfPackageDisplayName(item)} registration is closed`}
                        >
                          <span>Registration closed</span>
                          <i aria-hidden="true" />
                        </button>
                      ) : item.checkoutUrl &&
                      !isSoldOut &&
                      (item.kind === "SPONSORSHIP" ||
                        includedGolfSlotCount(item.includedGolf) > 0) ? (
                        <GolfCheckoutButton
                          packageId={item.id}
                          packageName={formatGolfPackageDisplayName(item)}
                          isSponsorship={item.kind === "SPONSORSHIP"}
                          includedPlayerCount={includedGolfSlotCount(
                            item.includedGolf,
                          )}
                          collectsPlayerNames={requiresGolfPlayerNames(item)}
                          buttonLabel={
                            item.kind === "GOLF"
                              ? "Claim your spot"
                              : "Select package"
                          }
                        />
                      ) : item.checkoutUrl && !isSoldOut ? (
                        <a
                          className="golf-package-action"
                          href={item.checkoutUrl}
                          aria-label={`${item.kind === "GOLF" ? "Claim your spot" : "Select package"}: ${formatGolfPackageDisplayName(item)} — secure checkout powered by Stripe`}
                        >
                          <span>
                            {item.kind === "GOLF"
                              ? "Claim your spot"
                              : "Select package"}
                          </span>
                          <i aria-hidden="true" />
                        </a>
                      ) : (
                        <form action={createGolfCheckoutSessionAction}>
                          <input
                            type="hidden"
                            name="packageId"
                            value={item.id}
                          />
                          <button
                            className="golf-package-action"
                            disabled={isSoldOut}
                          >
                            <span>
                              {isSoldOut
                                ? "Sold out"
                                : item.kind === "GOLF"
                                  ? "Claim your spot"
                                  : "Select package"}
                            </span>
                            <i aria-hidden="true" />
                          </button>
                        </form>
                      )}
                    </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="golf-band golf-wrap">
          <div className="golf-section-head">
            <h2>Thank you to our tournament sponsors.</h2>
            <p>
              These businesses and families have stepped up for {GOLF_TOURNAMENT_TITLE}.
            </p>
          </div>
          <div className="golf-sponsor-wall">
            {confirmedSponsors.map((sponsor) => (
              <article
                className={`golf-sponsor-tile golf-sponsor-tile-confirmed${
                  "outlineLogo" in sponsor && sponsor.outlineLogo
                    ? " golf-sponsor-tile-outline"
                    : ""
                }`}
                key={sponsor.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sponsor.logo} alt={`${sponsor.name} logo`} />
              </article>
            ))}
            {approvedSponsors.map(({ purchase, asset, packageConfig }) => {
              const name =
                purchase.sponsorRecognitionName ||
                purchase.sponsorDisplayName ||
                "BGSL sponsor";
              const websiteUrl = normalizeSponsorUrl(purchase.sponsorWebsiteUrl);
              const tile = (
                <article className="golf-sponsor-tile">
                  {asset && asset.contentType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/golf-tournament/sponsor-assets/${asset.id}`}
                      alt={`${name} logo`}
                    />
                  ) : (
                    <strong>{name}</strong>
                  )}
                  <span>{packageConfig?.name ?? "Tournament sponsor"}</span>
                </article>
              );
              return websiteUrl ? (
                <a
                  key={purchase.id}
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Visit ${name} website`}
                >
                  {tile}
                </a>
              ) : (
                <div key={purchase.id}>{tile}</div>
              );
            })}
          </div>
        </section>

      <section className="golf-band golf-band-mint" id="raffle">
        <div className="golf-wrap golf-raffle-grid">
          <div className="golf-section-head">
            <h2>Got a prize, gift card, or service?</h2>
            <p>
              Donate a gift card, product, service, or promotional item for the
              raffle. BGSL will recognize raffle and in-kind supporters during
              raffle announcements, on social, and on the website. Responses go
              to{" "}
              <a
                className="golf-email-link"
                href={`mailto:${contactEmail}`}
              >
                {contactEmail}
              </a>
              .
            </p>
          </div>
          <form
            className="golf-form"
            action={submitGolfInKindDonationAction}
          >
            <label>
              Donor or business name
              <input name="donorName" placeholder="Business or family name" />
            </label>
            <label>
              Contact email
              <input name="email" type="email" placeholder="name@example.com" />
            </label>
            <label>
              Item or service
              <textarea
                name="description"
                placeholder="Gift card, basket, service, product, or promotional item"
              />
            </label>
            <button className="golf-button golf-button-primary">
              Submit Donation
            </button>
          </form>
        </div>
      </section>

      <section className="golf-band golf-wrap" id="faq">
        <div className="golf-section-head">
          <h2>FAQs</h2>
        </div>
        <div className="golf-faq">
          <FaqItem
            question={
              GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED
                ? "Already registered? When do I provide player names?"
                : "When do I provide player names?"
            }
            answer={
              GOLF_TOURNAMENT_GOLFER_REGISTRATION_CLOSED
                ? "Use the completion link BGSL sent after registration to add player names. BGSL can help update a name later if plans change."
                : "Before continuing to Stripe, the organizer enters both twosome names or all four foursome names in the registration popup. BGSL can help update a name later if plans change."
            }
          />
          <FaqItem
            question="Can sponsors provide included golfer names later?"
            answer="Packages that include a foursome collect all four player names before checkout so BGSL can reconcile the registration with payment. Contact BGSL if a golfer needs to be changed later."
          />
          <FaqItem
            question="What does this support?"
            answer={GOLF_TOURNAMENT_SAFE_PROCEEDS}
          />
          <FaqItem
            question="What does scramble format mean?"
            answer="Your foursome plays as one team. Everyone tees off, the group chooses its best shot, and all four golfers play their next shot from that spot. You repeat the process until the ball is in the hole, recording one team score per hole."
          />
          <FaqItem
            question="How do the on-course contests work?"
            answer="Closest to the Pin rewards the tee shot that finishes nearest the hole on the designated par-3 holes. Longest Drive rewards the longest eligible tee shot on its designated hole. The Longest Marshmallow Drive is the playful version: golfers hit a marshmallow instead of a golf ball, and the farthest one wins. Final eligibility and tie-breaking rules will be shared before play."
          />
          <FaqItem
            question="What are mulligans and the 50/50 raffle?"
            answer="A mulligan lets a golfer replay a shot without counting the first attempt. They will be available for $5 each or five for $20. In a 50/50 raffle, participants buy tickets and one winner receives half of the raffle pot; the other half supports BGSL. Final purchase and drawing details will be shared before the tournament."
          />
          <FaqItem
            question="What does sponsoring a contest mean?"
            answer="A contest sponsorship helps fund the tournament and gives the sponsor recognition tied to a designated activity or hole. Depending on the package, that may include course signage, BGSL social and website recognition, and included golfer registrations. The sponsor does not need to run or officiate the contest."
          />
          <FaqItem
            question="Who do I contact with questions?"
            answer={
              <>
                Email{" "}
                <a
                  className="golf-email-link"
                  href={`mailto:${contactEmail}`}
                >
                  {contactEmail}
                </a>
                .
              </>
            }
          />
        </div>
      </section>

      <footer className="golf-footer">
        <div className="golf-wrap golf-footer-inner">
          <div className="golf-footer-lead">
            <strong>
              Tee Up for
              <br />
              Beverly Girls Softball
            </strong>
            <p>
            Thank you for helping create opportunities for girls in our
            community to learn, compete, and grow through softball.
            </p>
          </div>

          <div className="golf-footer-details">
            <div>
              <span>Course</span>
              <a
                href="https://beverlygolfandtennis.com/"
                target="_blank"
                rel="noreferrer"
              >
                {GOLF_TOURNAMENT_VENUE}
              </a>
              <p>{GOLF_TOURNAMENT_ADDRESS}</p>
            </div>
            <div>
              <span>Questions</span>
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </div>
          </div>

          <div className="golf-footer-signoff">
            <span>
              <a href="https://bgsl.net/" target="_blank" rel="noreferrer">
                Beverly Girls Softball League
              </a>{" "}
              · 2026
            </span>
            <a href="mailto:jelee85@gmail.com">Designed by JL</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

async function listApprovedSponsors() {
  try {
    const approvedSponsorPurchases =
      await db.query.golfTournamentPurchases.findMany({
        where: and(
          eq(golfTournamentPurchases.paymentStatus, "PAID"),
          eq(golfTournamentPurchases.approvedForPublicDisplay, true),
        ),
        orderBy: (table, { desc }) => [desc(table.approvedPublicDisplayAt)],
      });
    const approvedSponsorAssets = await db.query.golfTournamentAssets.findMany({
      where: eq(golfTournamentAssets.approvedForPublicDisplay, true),
      orderBy: (table, { desc }) => [desc(table.approvedPublicDisplayAt)],
    });

    return approvedSponsorPurchases
      .map((purchase) => ({
        purchase,
        asset: approvedSponsorAssets.find(
          (asset) => asset.purchaseId === purchase.id,
        ),
        packageConfig: getGolfTournamentPackage(purchase.packageId),
      }))
      .filter(
        ({ purchase }) =>
          purchase.sponsorDisplayName || purchase.sponsorRecognitionName,
      );
  } catch (error) {
    console.warn("[golf-tournament] sponsor wall unavailable", error);
    return [];
  }
}

async function listGolfPackageSoldCounts() {
  try {
    const rows = await db
      .select({
        packageId: golfTournamentPurchases.packageId,
        soldCount: count(),
      })
      .from(golfTournamentPurchases)
      .where(golfInventoryCommitmentCondition())
      .groupBy(golfTournamentPurchases.packageId);

    return new Map(rows.map((row) => [row.packageId, Number(row.soldCount)]));
  } catch (error) {
    console.warn("[golf-tournament] availability unavailable", error);
    return new Map<string, number>();
  }
}

function GolfNotice({
  checkout,
  inKind,
  contactEmail,
}: {
  checkout?: string;
  inKind?: string;
  contactEmail: string;
}) {
  if (inKind === "thanks") {
    return (
      <div className="golf-wrap golf-alert" role="status">
        Thanks. Your raffle or in-kind donation idea was submitted for BGSL to
        review.
      </div>
    );
  }

  if (!checkout) return null;

  if (checkout === "setup-pending") {
    return (
      <div className="golf-wrap golf-alert" role="status">
        Online payment is being connected. No payment was submitted. For help,
        email{" "}
        <a
          className="golf-email-link"
          href={`mailto:${contactEmail}`}
        >
          {contactEmail}
        </a>
        .
      </div>
    );
  }

  const message =
    {
      "sold-out": "That package is sold out. Pick another option or contact BGSL.",
      "registration-closed":
        GOLF_REGISTRATION_CLOSED_MESSAGE,
      unavailable:
        "That package is not available right now. Pick another option or contact BGSL.",
      cancelled: "Checkout was cancelled. Your card was not charged.",
    }[checkout] ?? null;

  if (!message) return null;

  return (
    <div className="golf-wrap golf-alert" role="status">
      {message}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: ReactNode }) {
  return (
    <article className="golf-faq-item">
      <h3>{question}</h3>
      <p>{answer}</p>
    </article>
  );
}

function normalizeSponsorUrl(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).toString();
  } catch {
    return null;
  }
}
