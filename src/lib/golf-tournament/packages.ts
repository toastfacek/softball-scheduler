export type GolfPackageCategory =
  | "PLAY_GOLF"
  | "HOLE_OR_CONTEST"
  | "TOURNAMENT_EXPERIENCE";

export type GolfPackageKind = "GOLF" | "SPONSORSHIP";

export type IncludedGolf = "NONE" | "ONE_PLAYER" | "TWOSOME" | "FOURSOME";

export type GolfTournamentPackage = {
  id: string;
  kind: GolfPackageKind;
  category: GolfPackageCategory;
  name: string;
  checkoutUrl?: string;
  priceCents: number;
  availability: string;
  capacity: number | null;
  includedGolf: IncludedGolf;
  featured?: boolean;
  locationLabel?: string;
  benefits: string[];
};

export const GOLF_TOURNAMENT_YEAR = 2026;

export const golfTournamentPackages: GolfTournamentPackage[] = [
  {
    id: "foursome-registration",
    kind: "GOLF",
    category: "PLAY_GOLF",
    name: "Foursome Registration",
    checkoutUrl:
      "https://buy.stripe.com/aFa00i36afh98Uh9qagfu00?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=foursome_registration",
    priceCents: 64000,
    availability: "Available",
    capacity: null,
    includedGolf: "FOURSOME",
    featured: true,
    benefits: [
      "Green Fees",
      "Cart Fees",
      "Lunch",
      "Registration for one (1) foursome",
      "All four player names are collected before checkout",
    ],
  },
  {
    id: "tee-box-green-sponsor",
    kind: "SPONSORSHIP",
    category: "HOLE_OR_CONTEST",
    name: "Tee Box or Green Sponsor",
    checkoutUrl:
      "https://donate.stripe.com/cNi7sK9uyfh9daxdGqgfu02?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=tee_box_green",
    priceCents: 20000,
    availability: "Multiple available",
    capacity: null,
    includedGolf: "NONE",
    benefits: [
      "Company name and/or logo signage at one tee box or green",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "closest-to-pin-sponsor",
    kind: "SPONSORSHIP",
    category: "HOLE_OR_CONTEST",
    name: "Closest to the Pin Contest Sponsor",
    checkoutUrl:
      "https://donate.stripe.com/5kQfZg2261qj1rP8m6gfu03?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=closest_to_pin",
    priceCents: 30000,
    availability: "2 available",
    capacity: 2,
    includedGolf: "NONE",
    locationLabel: "Holes 6 & 15",
    benefits: [
      "Company name and/or logo signage at designated contest hole",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "longest-drive-sponsor",
    kind: "SPONSORSHIP",
    category: "HOLE_OR_CONTEST",
    name: "Longest Drive Contest Sponsor",
    checkoutUrl:
      "https://buy.stripe.com/fZu4gy8qu6KD3zX8m6gfu04?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=longest_drive",
    priceCents: 30000,
    availability: "1 available",
    capacity: 1,
    includedGolf: "NONE",
    locationLabel: "Hole 17",
    benefits: [
      "Company name and/or logo signage at designated contest hole",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "longest-marshmallow-drive-sponsor",
    kind: "SPONSORSHIP",
    category: "HOLE_OR_CONTEST",
    name: "Longest Marshmallow Drive Sponsor",
    checkoutUrl:
      "https://buy.stripe.com/dRm3cucGKgld9Yl9qagfu05?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=longest_marshmallow_drive",
    priceCents: 50000,
    availability: "1 available",
    capacity: 1,
    includedGolf: "ONE_PLAYER",
    locationLabel: "Hole 9",
    benefits: [
      "Company name and/or logo signage at the contest hole",
      "One (1) player registration included",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "double-play-sponsor",
    kind: "SPONSORSHIP",
    category: "TOURNAMENT_EXPERIENCE",
    name: "Double Play Sponsor",
    checkoutUrl:
      "https://buy.stripe.com/aFaaEW6im7OHeeB0TEgfu06?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=double_play",
    priceCents: 80000,
    availability: "Available",
    capacity: null,
    includedGolf: "TWOSOME",
    benefits: [
      "Company name and/or logo signage at two tee boxes or greens",
      "One (1) twosome registration included",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "sunrise-breakfast-sponsor",
    kind: "SPONSORSHIP",
    category: "TOURNAMENT_EXPERIENCE",
    name: "Sunrise Breakfast Sponsor",
    checkoutUrl:
      "https://buy.stripe.com/00w7sKayC8SLgmJfOygfu07?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=sunrise_breakfast",
    priceCents: 100000,
    availability: "1 available",
    capacity: 1,
    includedGolf: "TWOSOME",
    benefits: [
      "Prominent logo placement and optional branded materials displayed at the clubhouse breakfast station",
      "One (1) twosome registration included",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "golf-cart-sponsor",
    kind: "SPONSORSHIP",
    category: "TOURNAMENT_EXPERIENCE",
    name: "Golf Cart Sponsor",
    checkoutUrl:
      "https://buy.stripe.com/14AdR836a6KDc6t59Ugfu08?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=golf_cart",
    priceCents: 130000,
    availability: "1 available",
    capacity: 1,
    includedGolf: "TWOSOME",
    featured: true,
    benefits: [
      "Company logo and/or QR code displayed in every golf cart",
      "Premium placement in golf cart sign holders facing players",
      "One (1) twosome registration included",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "triple-play-sponsor",
    kind: "SPONSORSHIP",
    category: "TOURNAMENT_EXPERIENCE",
    name: "Triple Play Sponsor",
    checkoutUrl:
      "https://buy.stripe.com/6oU3cuayCb0T2vT45Qgfu09?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=triple_play",
    priceCents: 160000,
    availability: "Available",
    capacity: null,
    includedGolf: "FOURSOME",
    benefits: [
      "Company name and/or logo signage at three tee boxes or greens",
      "One (1) foursome registration included",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "grab-go-lunch-sponsor",
    kind: "SPONSORSHIP",
    category: "TOURNAMENT_EXPERIENCE",
    name: "Grab & Go Lunch Sponsor",
    checkoutUrl:
      "https://buy.stripe.com/fZu14mcGK1qjb2p59Ugfu0a?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=grab_go_lunch",
    priceCents: 220000,
    availability: "1 available",
    capacity: 1,
    includedGolf: "FOURSOME",
    benefits: [
      "Your company promotional items added to player cart lunch bags",
      "One (1) foursome registration included",
      "Recognition on BGSL social media and website",
    ],
  },
  {
    id: "grand-slam-sponsor",
    kind: "SPONSORSHIP",
    category: "TOURNAMENT_EXPERIENCE",
    name: "Grand Slam Sponsor",
    checkoutUrl:
      "https://buy.stripe.com/9B6dR8eOS7OH0nL0TEgfu0b?utm_source=bgsl_golf_site&utm_medium=website&utm_campaign=2026_golf_tournament&utm_content=grand_slam",
    priceCents: 250000,
    availability: "2 available",
    capacity: 2,
    includedGolf: "FOURSOME",
    benefits: [
      "Sponsor a gift bag for one of the top two winning foursomes featuring branded swag, gift cards, coupons, or promotional items",
      "A portion of sponsorship supports tournament cash prizes",
      "Company name and/or logo signage at two tee boxes or greens",
      "One (1) foursome registration included",
      "Recognition on BGSL social media and website",
    ],
  },
];

export const golfPackageCategories: Array<{
  id: GolfPackageCategory;
  label: string;
  description: string;
}> = [
  {
    id: "PLAY_GOLF",
    label: "Play Golf",
    description: "Register a foursome and lock in your spot.",
  },
  {
    id: "HOLE_OR_CONTEST",
    label: "Sponsor a Hole or Contest",
    description: "Put your business at a tee, green, or tournament challenge.",
  },
  {
    id: "TOURNAMENT_EXPERIENCE",
    label: "Sponsor the Tournament Experience",
    description: "Support the moments every player will see and remember.",
  },
];

export function formatGolfPackagePrice(priceCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export function getGolfTournamentPackage(packageId: string) {
  return golfTournamentPackages.find((item) => item.id === packageId) ?? null;
}

export function includedGolfSlotCount(includedGolf: IncludedGolf) {
  switch (includedGolf) {
    case "NONE":
      return 0;
    case "ONE_PLAYER":
      return 1;
    case "TWOSOME":
      return 2;
    case "FOURSOME":
      return 4;
  }
}

export function estimatedStripeFeeCents(amountCents: number) {
  return Math.round(amountCents * 0.029) + 30;
}

export function estimatedStripeNetCents(amountCents: number) {
  return amountCents - estimatedStripeFeeCents(amountCents);
}
