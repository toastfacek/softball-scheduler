import Link from "next/link";

import { sendGolfConfirmationPreviewAction } from "@/actions/golf-admin-actions";
import { SubmitButton } from "@/components/submit-button";
import { requireGolfAdmin } from "@/lib/golf-tournament/admin-auth";
import { buildGolfConfirmationEmail } from "@/lib/golf-tournament/confirmation-email";

export const dynamic = "force-dynamic";

type GolfConfirmationEmailPreviewPageProps = {
  searchParams?: Promise<{ sent?: string }>;
};

export default async function GolfConfirmationEmailPreviewPage({
  searchParams,
}: GolfConfirmationEmailPreviewPageProps) {
  await requireGolfAdmin();
  const params = (await searchParams) ?? {};
  const preview = buildGolfConfirmationEmail({
    buyerName: "Michelle",
    packageName: "Tee Box or Green Sponsor",
    amount: "$200",
    kind: "sponsorship",
    benefits: [
      "Company name and/or logo signage at one tee box or green",
      "Recognition on BGSL social media and website",
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
              Suggested subject: {preview.subject}
            </p>
          </div>
          <div className="flex gap-2">
            <form action={sendGolfConfirmationPreviewAction}>
              <SubmitButton label="Send sponsor test to Michelle" />
            </form>
            <Link className="btn-secondary" href="/golf-admin">
              Back to admin
            </Link>
          </div>
        </div>
        {params.sent === "1" ? (
          <div className="saved-flash">Sponsor test email sent to Michelle.</div>
        ) : null}
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
