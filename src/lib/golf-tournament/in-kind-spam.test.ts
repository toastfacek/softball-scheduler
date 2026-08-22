import assert from "node:assert/strict";
import test from "node:test";

import {
  assessInKindSubmission,
  classifyInKindSubmission,
} from "./in-kind-spam";

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

test("does not hold ordinary names with common consonant clusters", () => {
  for (const donorName of [
    "McCarthy",
    "Thompson",
    "Schmidt",
    "Krzysztof",
    "Szczepan",
    "Tsvetan",
  ]) {
    const decision = classifyInKindSubmission({
      donorName,
      email: "donor@beverlyhardware.com",
      itemDescription: "$50 gift card for the raffle",
    });

    assert.equal(decision.disposition, "FORWARD_TO_MICHELLE", donorName);
  }
});

test("flags rotating synthetic donor names for discard", () => {
  const donorNames = ["Bzcoxin", "Dupalpxg", "Pbjobsd", "Cnhhpaagq"];

  for (const donorName of donorNames) {
    const decision = classifyInKindSubmission({
      donorName,
      email: "person@gray.tv",
      itemDescription: "$50 gift card for the raffle",
    });

    assert.equal(decision.disposition, "FLAG_FOR_DISCARD", donorName);
  }
});

test("forwards ordinary donation names", () => {
  const decision = classifyInKindSubmission({
    donorName: "Beverly Hardware",
    email: "donor@beverlyhardware.com",
    itemDescription: "$50 gift card for the raffle",
  });

  assert.equal(decision.disposition, "FORWARD_TO_MICHELLE");
});
