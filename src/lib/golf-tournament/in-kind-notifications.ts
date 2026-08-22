import { env } from "@/lib/env";
import { sendGolfTournamentEmail } from "@/lib/golf-tournament/email";
import { golfTournamentContactEmail } from "@/lib/golf-tournament/event";
import type { InKindSubmissionContent } from "@/lib/golf-tournament/in-kind-spam";

export function sendLegitimateInKindSubmissionEmail({
  donorName,
  email,
  itemDescription,
}: InKindSubmissionContent) {
  return sendGolfTournamentEmail({
    to: [golfTournamentContactEmail()],
    subject: "New BGSL golf raffle/in-kind submission",
    body: [
      "A likely legitimate raffle or in-kind donation was submitted.",
      "",
      `Donor: ${donorName}`,
      `Email: ${email}`,
      `Item: ${itemDescription}`,
      "",
      "This submission passed the automatic abuse screen and is ready for review.",
      "",
      `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/golf-admin`,
    ].join("\n"),
  });
}
