import type { golfTournamentInKindSubmissions } from "@/db/schema";

type InKindSubmission = typeof golfTournamentInKindSubmissions.$inferSelect;

export type InKindSpamCandidate = {
  submission: InKindSubmission;
  reasons: string[];
  score: number;
  eligibleForFlag: boolean;
};

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

export function scanInKindSubmissions(
  submissions: InKindSubmission[],
): InKindSpamCandidate[] {
  const duplicateIndexes = findDuplicateIndexes(submissions);

  return submissions.flatMap((submission, index) => {
    if (submission.status === "ACCEPTED" || submission.status === "DECLINED") {
      return [];
    }

    const reasons: string[] = [];
    let score = 0;
    const normalizedEmail = normalizeForComparison(submission.email);
    const emailDomain = normalizedEmail.split("@").at(-1) ?? "";
    const emailLocalPart = normalizedEmail.split("@")[0] ?? "";
    const normalizedDonorName = normalizeForComparison(submission.donorName);
    const normalizedDescription = normalizeForComparison(
      submission.itemDescription,
    );

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

    if (duplicateIndexes.has(index)) {
      reasons.push("Repeated email and item description");
      score += 3;
    }

    if (score < 3) return [];

    return [
      {
        submission,
        reasons,
        score,
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
      normalizeForComparison(submission.email),
      normalizeForComparison(submission.itemDescription),
    ].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(index);
    groups.set(key, group);
  }

  return new Set(
    [...groups.values()].flatMap((indexes) => indexes.slice(1)),
  );
}

function normalizeForComparison(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, " ");
}

function containsUrl(value: string) {
  return /(?:https?:\/\/|www\.|bit\.ly\/|tinyurl\.com\/)/i.test(value);
}
