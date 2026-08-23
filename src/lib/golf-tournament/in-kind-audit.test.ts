import assert from "node:assert/strict";
import test from "node:test";

import { inKindQuarantineExpiry } from "./in-kind-audit";

const now = new Date("2026-08-23T12:00:00.000Z");

test("keeps spam in a private quarantine for fourteen days", () => {
  assert.equal(
    inKindQuarantineExpiry("SPAM", now)?.toISOString(),
    "2026-09-06T12:00:00.000Z",
  );
});

test("keeps an unavailable judge record briefly for recovery", () => {
  assert.equal(
    inKindQuarantineExpiry("JUDGE_UNAVAILABLE", now)?.toISOString(),
    "2026-08-24T12:00:00.000Z",
  );
});

test("does not quarantine visible outcomes", () => {
  assert.equal(inKindQuarantineExpiry("REVIEW", now), null);
  assert.equal(inKindQuarantineExpiry("CLEAR", now), null);
});
