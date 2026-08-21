import assert from "node:assert/strict";
import test from "node:test";

import { assessInKindSubmission } from "./in-kind-spam";

test("holds a synthetic-looking donor and item combination", () => {
  const assessment = assessInKindSubmission({
    donorName: "Lkyhss",
    email: "melissa.cooley@gray.tv",
    itemDescription: "CLqvtNXtXfyZCkfEisg",
  });

  assert.equal(assessment.shouldHold, true);
  assert.deepEqual(assessment.reasons, [
    "Synthetic-looking donor name",
    "Synthetic-looking item description",
  ]);
});

test("does not hold an ordinary raffle donation", () => {
  const assessment = assessInKindSubmission({
    donorName: "Beverly Hardware",
    email: "donor@beverlyhardware.com",
    itemDescription: "$50 gift card for the raffle",
  });

  assert.equal(assessment.shouldHold, false);
});

test("does not hold a legitimate compound item code", () => {
  const assessment = assessInKindSubmission({
    donorName: "Brynn",
    email: "brynn@beverlyhardware.com",
    itemDescription: "BlackTshirtXXL",
  });

  assert.equal(assessment.shouldHold, false);
});
