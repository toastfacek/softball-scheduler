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

test("flags the latest synthetic submission pattern", () => {
  const decision = classifyInKindSubmission({
    donorName: "Dpzal",
    email: "sth1574@nate.com",
    itemDescription: "AQTcclauhPEnnZQWJnCIylx",
  });

  assert.equal(decision.disposition, "DEFINITE_SPAM");
});

test("flags a gibberish item even with an ordinary donor", () => {
  const decision = classifyInKindSubmission({
    donorName: "Beverly Hardware",
    email: "donor@beverlyhardware.com",
    itemDescription: "AQTcclauhPEnnZQWJnCIylx",
  });

  assert.equal(decision.disposition, "DEFINITE_SPAM");
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

    assert.equal(decision.disposition, "REQUIRES_LLM", donorName);
  }
});

test("flags rotating synthetic donor names for discard", () => {
  const donorNames = [
    "Dpzal",
    "Bzcoxin",
    "Dupalpxg",
    "Pbjobsd",
    "Cnhhpaagq",
  ];

  for (const donorName of donorNames) {
    const decision = classifyInKindSubmission({
      donorName,
      email: "person@gray.tv",
      itemDescription: "$50 gift card for the raffle",
    });

    assert.equal(decision.disposition, "REQUIRES_LLM", donorName);
  }
});

test("forwards ordinary donation names", () => {
  const decision = classifyInKindSubmission({
    donorName: "Beverly Hardware",
    email: "donor@beverlyhardware.com",
    itemDescription: "$50 gift card for the raffle",
  });

  assert.equal(decision.disposition, "REQUIRES_LLM");
});

test("does not treat a terse but possible item as definite spam", () => {
  const decision = classifyInKindSubmission({
    donorName: "Brynn",
    email: "brynn@beverlyhardware.com",
    itemDescription: "BlackTshirtXXL",
  });

  assert.equal(decision.disposition, "REQUIRES_LLM");
});
