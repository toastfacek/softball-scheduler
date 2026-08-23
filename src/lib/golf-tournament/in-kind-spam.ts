import type { golfTournamentInKindSubmissions } from "@/db/schema";

type InKindSubmission = typeof golfTournamentInKindSubmissions.$inferSelect;

export type InKindSubmissionContent = Pick<
  InKindSubmission,
  "donorName" | "email" | "itemDescription"
>;

export type InKindSpamCandidate = {
  submission: InKindSubmission;
  reasons: string[];
  score: number;
  eligibleForFlag: boolean;
};

export type InKindSubmissionAssessment = {
  reasons: string[];
  score: number;
  shouldHold: boolean;
};

export type InKindSubmissionDisposition =
  | "FORWARD_TO_MICHELLE"
  | "FLAG_FOR_DISCARD";

export type InKindSubmissionDecision = {
  assessment: InKindSubmissionAssessment;
  disposition: InKindSubmissionDisposition;
};

type InKindAssessmentInput = InKindSubmissionContent & {
  repeated?: boolean;
};

// High-confidence synthetic donor names cross this threshold on their own;
// weaker signals still need to combine before a submission is held.
const HOLD_SCORE = 5;

const PLACEHOLDER_MARKERS = new Set([
  "asdf",
  "fake",
  "invalid",
  "na",
  "none",
  "noemail",
  "noreply",
  "qwerty",
  "spam",
  "test",
  "testing",
  "unknown",
  "xxx",
]);

const PLACEHOLDER_DOMAINS = new Set([
  "10minutemail.com",
  "example.com",
  "example.net",
  "example.org",
  "guerrillamail.com",
  "invalid",
  "localhost",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "tempmail.com",
  "yopmail.com",
]);

const SPAM_PHRASES = [
  "adult content",
  "backlink",
  "bitcoin",
  "buy now",
  "casino bonus",
  "click here",
  "crypto",
  "earn money",
  "guest post",
  "payday loan",
  "press release",
  "seo service",
  "viagra",
  "weight loss",
];

// Common three-consonant clusters in ordinary names. The donor-name signal
// only treats an uncommon cluster as synthetic; this keeps names such as
// McCarthy, Thompson, and Schmidt out of the quarantine path.
const COMMON_NAME_CONSONANT_CLUSTERS = new Set([
  "chr",
  "krz",
  "ght",
  "lth",
  "mcc",
  "mck",
  "mps",
  "nch",
  "nds",
  "nth",
  "nts",
  "rch",
  "rds",
  "rth",
  "rts",
  "sch",
  "scr",
  "shr",
  "sph",
  "spl",
  "spr",
  "sts",
  "str",
  "szt",
  "szc",
  "tch",
  "thr",
  "tsv",
]);

export function assessInKindSubmission({
  donorName,
  email,
  itemDescription,
  repeated = false,
}: InKindAssessmentInput): InKindSubmissionAssessment {
  const reasons: string[] = [];
  let score = 0;
  const normalizedEmail = normalizeInKindText(email);
  const emailDomain = normalizedEmail.split("@").at(-1) ?? "";
  const emailLocalPart = normalizedEmail.split("@")[0] ?? "";
  const normalizedDonorName = normalizeInKindText(donorName);
  const normalizedDescription = normalizeInKindText(itemDescription);

  if (
    PLACEHOLDER_MARKERS.has(emailLocalPart) ||
    PLACEHOLDER_MARKERS.has(emailLocalPart.replaceAll(/[._+-]/g, ""))
  ) {
    reasons.push("Placeholder or test email");
    score += 3;
  }

  if (PLACEHOLDER_DOMAINS.has(emailDomain)) {
    reasons.push("Temporary or invalid email domain");
    score += 3;
  }

  if (PLACEHOLDER_MARKERS.has(normalizedDonorName)) {
    reasons.push("Placeholder donor name");
    score += 3;
  }

  if (looksLikeSyntheticDonorName(donorName)) {
    reasons.push("Synthetic-looking donor name");
    score += HOLD_SCORE;
  }

  const syntheticItemScore = scoreSyntheticToken(itemDescription, 12);
  if (syntheticItemScore > 0) {
    reasons.push("Synthetic-looking item description");
    score += syntheticItemScore;
  }

  const combinedText = [
    normalizedEmail,
    normalizedDonorName,
    normalizedDescription,
  ].join(" ");

  if (containsUrl(combinedText)) {
    reasons.push("Contains a link");
    score += 3;
  }

  if (SPAM_PHRASES.some((phrase) => combinedText.includes(phrase))) {
    reasons.push("Spam-like language");
    score += 4;
  }

  if (repeated) {
    reasons.push("Repeated email and item description");
    score += 3;
  }

  return {
    reasons,
    score,
    shouldHold: score >= HOLD_SCORE,
  };
}

export function classifyInKindSubmission(
  input: InKindAssessmentInput,
): InKindSubmissionDecision {
  const assessment = assessInKindSubmission(input);

  return {
    assessment,
    disposition: assessment.shouldHold
      ? "FLAG_FOR_DISCARD"
      : "FORWARD_TO_MICHELLE",
  };
}

export function scanInKindSubmissions(
  submissions: InKindSubmission[],
): InKindSpamCandidate[] {
  const duplicateIndexes = findDuplicateIndexes(submissions);

  return submissions.flatMap((submission, index) => {
    if (submission.status === "ACCEPTED" || submission.status === "DECLINED") {
      return [];
    }

    const assessment = assessInKindSubmission({
      donorName: submission.donorName,
      email: submission.email,
      itemDescription: submission.itemDescription,
      repeated: duplicateIndexes.has(index),
    });

    if (assessment.score < 3) return [];

    return [
      {
        submission,
        reasons: assessment.reasons,
        score: assessment.score,
        eligibleForFlag: submission.status === "NEW",
      },
    ];
  });
}

function findDuplicateIndexes(submissions: InKindSubmission[]) {
  const groups = new Map<string, number[]>();
  const orderedIndexes = submissions
    .map((submission, index) => ({
      index,
      createdAt: submission.createdAt.getTime(),
    }))
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const { index } of orderedIndexes) {
    const submission = submissions[index];
    const key = [
      normalizeInKindText(submission.email),
      normalizeInKindText(submission.itemDescription),
    ].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(index);
    groups.set(key, group);
  }

  return new Set(
    [...groups.values()].flatMap((indexes) => indexes.slice(1)),
  );
}

export function normalizeInKindText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, " ");
}

function scoreSyntheticToken(value: string, minimumLength: number) {
  const normalized = value.normalize("NFKC").trim();
  const letters = normalized.match(/[a-z]/gi)?.join("") ?? "";
  const vowelCount = letters.match(/[aeiou]/gi)?.length ?? 0;
  const uppercaseCount = normalized.match(/[A-Z]/g)?.length ?? 0;
  const naturalWordRuns = normalized.match(/[a-z]{4,}/g) ?? [];
  const looksLikeMixedCaseCode =
    letters.length >= 18 &&
    uppercaseCount / letters.length >= 0.4 &&
    vowelCount / letters.length <= 0.3 &&
    (normalized.match(/[a-z][A-Z]|[A-Z][a-z]/g)?.length ?? 0) >= 5;

  if (
    letters.length < minimumLength ||
    /\s/.test(normalized) ||
    !/[A-Z]/.test(normalized) ||
    !/[a-z]/.test(normalized)
  ) {
    return 0;
  }

  if (looksLikeMixedCaseCode) return HOLD_SCORE;

  if (naturalWordRuns.some((run) => /[aeiou]/.test(run))) return 0;

  return vowelCount / letters.length < 0.2 ? 4 : 0;
}

function looksLikeSyntheticDonorName(value: string) {
  const normalized = value.normalize("NFKC").trim();

  if (!/^[A-Z][a-z]+$/.test(normalized) || normalized.length < 5) {
    return false;
  }

  const letters = normalized.toLowerCase();
  const vowelCount = letters.match(/[aeiouy]/g)?.length ?? 0;
  const hasRareConsonantCluster = (letters.match(/[^aeiouy]+/g) ?? []).some(
    (run) =>
      run.length >= 3 &&
      ![...COMMON_NAME_CONSONANT_CLUSTERS].some((cluster) =>
        run.includes(cluster),
      ),
  );

  return vowelCount / letters.length <= 0.3 && hasRareConsonantCluster;
}

function containsUrl(value: string) {
  return /(?:https?:\/\/|www\.|bit\.ly\/|tinyurl\.com\/)/i.test(value);
}
