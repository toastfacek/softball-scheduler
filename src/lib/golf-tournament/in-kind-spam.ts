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

type InKindAssessmentInput = InKindSubmissionContent & {
  repeated?: boolean;
};

// A single unusual field stays below this threshold; synthetic-looking donor
// and item values together cross it.
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

  if (looksLikeSyntheticToken(donorName, 5)) {
    reasons.push("Synthetic-looking donor name");
    score += 2;
  }

  if (looksLikeSyntheticToken(itemDescription, 12)) {
    reasons.push("Synthetic-looking item description");
    score += 4;
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

function looksLikeSyntheticToken(value: string, minimumLength: number) {
  const normalized = value.normalize("NFKC").trim();
  const letters = normalized.match(/[a-z]/gi)?.join("") ?? "";
  const vowelCount = letters.match(/[aeiou]/gi)?.length ?? 0;
  const naturalWordRuns = normalized.match(/[a-z]{4,}/g) ?? [];

  if (
    letters.length < minimumLength ||
    /\s/.test(normalized) ||
    !/[A-Z]/.test(normalized) ||
    !/[a-z]/.test(normalized) ||
    naturalWordRuns.some((run) => /[aeiou]/.test(run))
  ) {
    return false;
  }

  return vowelCount / letters.length < 0.2;
}

function containsUrl(value: string) {
  return /(?:https?:\/\/|www\.|bit\.ly\/|tinyurl\.com\/)/i.test(value);
}
