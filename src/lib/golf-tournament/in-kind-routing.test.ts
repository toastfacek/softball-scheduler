import assert from "node:assert/strict";
import test from "node:test";

import { routeInKindSubmission } from "./in-kind-routing";

test("discards deterministic high-confidence spam without an LLM call", () => {
  assert.equal(
    routeInKindSubmission({
      deterministicDisposition: "DEFINITE_SPAM",
      llmReview: null,
    }),
    "DISCARD",
  );
});

test("does not email when the judge is unavailable", () => {
  assert.equal(
    routeInKindSubmission({
      deterministicDisposition: "REQUIRES_LLM",
      llmReview: {
        status: "SKIPPED",
        verdict: "SKIPPED",
        reason: "AI review is not configured.",
      },
    }),
    "JUDGE_UNAVAILABLE",
  );
});

test("discards a successful spam verdict", () => {
  assert.equal(
    routeInKindSubmission({
      deterministicDisposition: "REQUIRES_LLM",
      llmReview: {
        status: "SUCCEEDED",
        verdict: "SPAM",
        reason: "The item is an unrecognizable random string.",
      },
    }),
    "DISCARD",
  );
});

test("queues a successful review verdict", () => {
  assert.equal(
    routeInKindSubmission({
      deterministicDisposition: "REQUIRES_LLM",
      llmReview: {
        status: "SUCCEEDED",
        verdict: "REVIEW",
        reason: "The item could be real but is too vague to confirm.",
      },
    }),
    "QUEUE",
  );
});

test("emails only a successful clear verdict", () => {
  assert.equal(
    routeInKindSubmission({
      deterministicDisposition: "REQUIRES_LLM",
      llmReview: {
        status: "SUCCEEDED",
        verdict: "CLEAR",
        reason: "A coherent gift basket is a plausible raffle donation.",
      },
    }),
    "EMAIL",
  );
});
