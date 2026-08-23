import assert from "node:assert/strict";
import test from "node:test";

import {
  extractInKindLlmResponseMetadata,
  parseInKindLlmResponse,
  reviewInKindSubmissionWithLlm,
} from "./in-kind-llm";

const testSubmission = {
  donorName: "Beverly Hardware",
  email: "donor@beverlyhardware.com",
  itemDescription: "$50 gift card for the raffle",
};

test("extracts response metadata without retaining model content", () => {
  assert.deepEqual(
    extractInKindLlmResponseMetadata({
      id: "resp_123",
      model: "gpt-5.4-nano-2026-01-01",
      output_text: JSON.stringify({
        verdict: "CLEAR",
        reason: "A coherent gift basket donation.",
      }),
      usage: {
        input_tokens: 123,
        output_tokens: 45,
        total_tokens: 168,
      },
    }),
    {
      responseId: "resp_123",
      model: "gpt-5.4-nano-2026-01-01",
      inputTokens: 123,
      outputTokens: 45,
      totalTokens: 168,
    },
  );
});

test("parses a structured clear review", () => {
  assert.deepEqual(
    parseInKindLlmResponse({
      output_text: JSON.stringify({
        verdict: "CLEAR",
        reason: "The donor and gift card description are coherent.",
      }),
    }),
    {
      verdict: "CLEAR",
      reason: "The donor and gift card description are coherent.",
    },
  );
});

test("parses structured output nested in a response item", () => {
  assert.deepEqual(
    parseInKindLlmResponse({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                verdict: "SPAM",
                reason: "The item is an unrecognizable random string.",
              }),
            },
          ],
        },
      ],
    }),
    {
      verdict: "SPAM",
      reason: "The item is an unrecognizable random string.",
    },
  );
});

test("rejects malformed or out-of-schema model output", () => {
  assert.equal(parseInKindLlmResponse({ output_text: "not json" }), null);
  assert.equal(
    parseInKindLlmResponse({
      output_text: JSON.stringify({ verdict: "PLAUSIBLE" }),
    }),
    null,
  );
});

test("retries a transient judge failure before succeeding", async () => {
  let calls = 0;
  const review = await reviewInKindSubmissionWithLlm(testSubmission, {
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("temporarily unavailable", { status: 503 });
      }

      return new Response(
        JSON.stringify({
          id: "resp_success",
          model: "gpt-5.4-nano",
          output_text: JSON.stringify({
            verdict: "CLEAR",
            reason: "The gift card is a coherent donation.",
          }),
        }),
        { status: 200 },
      );
    },
    sleepImpl: async () => undefined,
  });

  assert.equal(calls, 2);
  assert.equal(review.status, "SUCCEEDED");
  assert.equal(review.verdict, "CLEAR");
  assert.equal(review.trace?.attempts, 2);
  assert.equal(review.trace?.attemptLog.length, 2);
  assert.equal(review.trace?.attemptLog[0]?.errorCode, "HTTP_ERROR");
  assert.equal(review.trace?.attemptLog[1]?.outcome, "SUCCEEDED");
});

test("fails closed after exhausting judge retries", async () => {
  let calls = 0;
  const review = await reviewInKindSubmissionWithLlm(testSubmission, {
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      return new Response("temporarily unavailable", { status: 503 });
    },
    sleepImpl: async () => undefined,
  });

  assert.equal(calls, 3);
  assert.equal(review.status, "FAILED");
  assert.equal(review.verdict, "REVIEW");
  assert.equal(review.trace?.attempts, 3);
  assert.equal(review.trace?.errorCode, "HTTP_ERROR");
  assert.equal(review.trace?.attemptLog.length, 3);
});

test("does not retry a permanent judge authorization error", async () => {
  let calls = 0;
  const review = await reviewInKindSubmissionWithLlm(testSubmission, {
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      return new Response("unauthorized", { status: 401 });
    },
    sleepImpl: async () => undefined,
  });

  assert.equal(calls, 1);
  assert.equal(review.status, "FAILED");
  assert.equal(review.trace?.attempts, 1);
  assert.equal(review.trace?.attemptLog.length, 1);
});

test("reports a missing judge configuration without pretending to review", async () => {
  const review = await reviewInKindSubmissionWithLlm(testSubmission, {
    apiKey: "",
  });

  assert.deepEqual(review, {
    status: "SKIPPED",
    verdict: "SKIPPED",
    reason: "AI review is not configured.",
  });
});
