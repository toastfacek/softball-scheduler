import assert from "node:assert/strict";
import test from "node:test";

import {
  extractInKindLlmResponseMetadata,
  parseInKindLlmResponse,
} from "./in-kind-llm";

test("extracts response metadata without retaining model content", () => {
  assert.deepEqual(
    extractInKindLlmResponseMetadata({
      id: "resp_123",
      model: "gpt-5.4-nano-2026-01-01",
      output_text: JSON.stringify({
        verdict: "PLAUSIBLE",
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

test("parses a structured plausible review", () => {
  assert.deepEqual(
    parseInKindLlmResponse({
      output_text: JSON.stringify({
        verdict: "PLAUSIBLE",
        reason: "The donor and gift card description are coherent.",
      }),
    }),
    {
      verdict: "PLAUSIBLE",
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
                verdict: "SUSPICIOUS",
                reason: "The item is an unrecognizable random string.",
              }),
            },
          ],
        },
      ],
    }),
    {
      verdict: "SUSPICIOUS",
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
