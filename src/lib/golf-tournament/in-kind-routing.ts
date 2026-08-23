import type { InKindLlmReview } from "@/lib/golf-tournament/in-kind-llm";
import type { InKindSubmissionDisposition } from "@/lib/golf-tournament/in-kind-spam";

export type InKindRoutingOutcome =
  | "DISCARD"
  | "QUEUE"
  | "EMAIL"
  | "JUDGE_UNAVAILABLE";

export function routeInKindSubmission({
  deterministicDisposition,
  llmReview,
}: {
  deterministicDisposition: InKindSubmissionDisposition;
  llmReview: InKindLlmReview | null;
}): InKindRoutingOutcome {
  if (deterministicDisposition === "DEFINITE_SPAM") {
    return "DISCARD";
  }

  if (!llmReview || llmReview.status !== "SUCCEEDED") {
    return "JUDGE_UNAVAILABLE";
  }

  switch (llmReview.verdict) {
    case "SPAM":
      return "DISCARD";
    case "REVIEW":
      return "QUEUE";
    case "CLEAR":
      return "EMAIL";
    case "SKIPPED":
      return "JUDGE_UNAVAILABLE";
  }
}
