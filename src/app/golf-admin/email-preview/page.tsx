import Link from "next/link";

import { requireGolfAdmin } from "@/lib/golf-tournament/admin-auth";
import { buildGolfConfirmationEmail } from "@/lib/golf-tournament/confirmation-email";

export const dynamic = "force-dynamic";

export default async function GolfConfirmationEmailPreviewPage() {
  await requireGolfAdmin();
  const preview = buildGolfConfirmationEmail({
    buyerName: "Michelle",
    packageName: "Foursome Registration",
    amount: "$640",
    playerNames: [
      "Michelle Lambert",
      "Missy Ulrich",
      "Meesh Ritchie",
      "Amie Crawford",
    ],
    tournamentUrl: "https://www.beverlysoftball.com/golf-tournament",
  });

  return (
    <main className="min-h-screen bg-[#e6eadb] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Customer communication</p>
            <h1 className="text-4xl text-navy-strong">Confirmation email</h1>
            <p className="mt-2 text-sm text-navy-soft">
              Subject: {preview.subject}
            </p>
          </div>
          <Link className="btn-secondary" href="/golf-admin">
            Back to admin
          </Link>
        </div>
        <div className="overflow-hidden border border-[#c7cdb9] bg-white shadow-[0_20px_60px_rgba(8,33,22,0.12)]">
          <iframe
            className="h-[920px] w-full bg-[#edf2df]"
            title="Golf tournament confirmation email preview"
            srcDoc={preview.html}
          />
        </div>
      </div>
    </main>
  );
}
