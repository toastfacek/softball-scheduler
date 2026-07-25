import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  updateGolfCompletionAction,
  uploadGolfLogoAction,
} from "@/actions/golf-tournament-actions";
import { db } from "@/db";
import {
  golfTournamentAssets,
  golfTournamentPlayers,
  golfTournamentPurchases,
} from "@/db/schema";
import {
  GOLF_TOURNAMENT_TITLE,
} from "@/lib/golf-tournament/event";
import {
  getGolfTournamentPackage,
  includedGolfSlotCount,
} from "@/lib/golf-tournament/packages";
import { hashCompletionToken } from "@/lib/golf-tournament/tokens";

type CompletionPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{
    saved?: string;
    upload?: string;
    details?: string;
  }>;
};

export default async function GolfCompletionPage({
  params,
  searchParams,
}: CompletionPageProps) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const tokenHash = hashCompletionToken(token);
  const purchase = await db.query.golfTournamentPurchases.findFirst({
    where: eq(golfTournamentPurchases.completionTokenHash, tokenHash),
  });

  if (
    !purchase ||
    purchase.completionTokenRevokedAt ||
    (purchase.completionTokenExpiresAt &&
      purchase.completionTokenExpiresAt < new Date())
  ) {
    notFound();
  }

  const packageConfig = getGolfTournamentPackage(purchase.packageId);
  const existingPlayers = await db.query.golfTournamentPlayers.findMany({
    where: eq(golfTournamentPlayers.purchaseId, purchase.id),
  });
  const uploadedAssets = await db.query.golfTournamentAssets.findMany({
    where: eq(golfTournamentAssets.purchaseId, purchase.id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  const slotCount = packageConfig
    ? includedGolfSlotCount(packageConfig.includedGolf)
    : 4;
  const playerSlots = Array.from({ length: Math.max(slotCount, 0) }, (_, i) => {
    const slotNumber = i + 1;
    return {
      slotNumber,
      name:
        existingPlayers.find((player) => player.slotNumber === slotNumber)
          ?.name ?? "",
    };
  });
  const isPaid = purchase.paymentStatus === "PAID";

  return (
    <main className="golf-page">
      <header className="golf-topbar golf-wrap">
        <Link href="/golf-tournament" className="golf-brand">
          <span className="golf-brand-mark">BGSL</span>
          <span>{GOLF_TOURNAMENT_TITLE}</span>
        </Link>
      </header>

      <section className="golf-band golf-wrap">
        {query.saved === "1" ? (
          <div className="golf-alert" role="status">
            Details saved. You can come back to this link and update them later.
          </div>
        ) : null}
        {query.details === "player-names" ? (
          <div className="golf-alert" role="alert">
            Please enter {slotCount === 2 ? "both" : "all four"} player names
            to complete the {slotCount === 2 ? "twosome" : "foursome"}{" "}
            registration.
          </div>
        ) : null}
        <UploadNotice upload={query.upload} />

        <div className="golf-section-head">
          <span className="golf-kicker">
            {isPaid ? "You're confirmed" : "Checkout pending"}
          </span>
          <h1>Help us finish your tournament details.</h1>
          <p>
            {isPaid
              ? packageConfig?.kind === "GOLF"
                ? `Your payment is confirmed. Add the contact information and ${
                    slotCount === 2 ? "both" : "all four"
                  } player names to complete registration.`
                : "Your payment is confirmed. Add sponsor details and included golfer information below."
              : "This link is ready, but payment has not been confirmed yet. Once Stripe confirms payment, this form becomes your detail hub."}
          </p>
        </div>

        <section className="golf-completion-layout">
          <aside className="golf-completion-summary">
            <span>Package</span>
            <strong>{packageConfig?.name ?? purchase.packageId}</strong>
            <span>Status</span>
            <strong>{purchase.paymentStatus.replaceAll("_", " ")}</strong>
            <span>Details</span>
            <strong>{purchase.fulfillmentStatus.replaceAll("_", " ")}</strong>
          </aside>

          <form className="golf-form" action={updateGolfCompletionAction}>
            <input type="hidden" name="token" value={token} />
            <label>
              Contact name
              <input
                name="buyerName"
                defaultValue={purchase.buyerName ?? ""}
                required
                disabled={!isPaid}
              />
            </label>
            <label>
              Contact phone
              <input
                name="buyerPhone"
                defaultValue={purchase.buyerPhone ?? ""}
                required
                disabled={!isPaid}
              />
            </label>

            {packageConfig?.kind === "SPONSORSHIP" ? (
              <>
                <label>
                  Sponsor or business display name
                  <input
                    name="sponsorDisplayName"
                    defaultValue={purchase.sponsorDisplayName ?? ""}
                    disabled={!isPaid}
                  />
                </label>
                <label>
                  Sponsor contact name
                  <input
                    name="sponsorContactName"
                    defaultValue={purchase.sponsorContactName ?? ""}
                    disabled={!isPaid}
                  />
                </label>
                <label>
                  Website URL
                  <input
                    name="sponsorWebsiteUrl"
                    defaultValue={purchase.sponsorWebsiteUrl ?? ""}
                    disabled={!isPaid}
                  />
                </label>
                <label>
                  Recognition name
                  <input
                    name="sponsorRecognitionName"
                    defaultValue={purchase.sponsorRecognitionName ?? ""}
                    disabled={!isPaid}
                  />
                </label>
                {slotCount > 0 ? (
                  <label>
                    Included golfer spots
                    <select
                      name="includedGolfIntent"
                      defaultValue={purchase.includedGolfIntent ?? "NOT_SURE"}
                      disabled={!isPaid}
                    >
                      <option value="WILL_USE">We will use them</option>
                      <option value="WILL_NOT_USE">
                        We do not plan to use them
                      </option>
                      <option value="NOT_SURE">Not sure yet</option>
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}

            {playerSlots.length > 0 ? (
              <fieldset className="golf-fieldset">
                <legend>Player names</legend>
                {playerSlots.map((slot) => (
                  <label key={slot.slotNumber}>
                    Player {slot.slotNumber}
                    <input
                      name={`player${slot.slotNumber}`}
                      defaultValue={slot.name}
                      placeholder="Full name"
                      required={packageConfig?.kind === "GOLF"}
                      disabled={!isPaid}
                    />
                  </label>
                ))}
              </fieldset>
            ) : null}

            <label>
              Notes
              <textarea
                name="sponsorNotes"
                defaultValue={purchase.sponsorNotes ?? ""}
                disabled={!isPaid}
              />
            </label>

            <button
              className="golf-button golf-button-primary"
              disabled={!isPaid}
            >
              Save Details
            </button>
          </form>
        </section>

        {packageConfig?.kind === "SPONSORSHIP" ? (
          <section className="golf-completion-layout golf-completion-upload">
            <aside className="golf-completion-summary">
              <span>Logo/artwork</span>
              <strong>Private review</strong>
              <p>
                Uploads are private by default. BGSL can review and approve a
                logo before it appears publicly.
              </p>
            </aside>
            <form className="golf-form" action={uploadGolfLogoAction}>
              <input type="hidden" name="token" value={token} />
              <label>
                Logo or sponsor artwork
                <input
                  name="logo"
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,.webp,.pdf,image/png,image/jpeg,image/svg+xml,image/webp,application/pdf"
                  disabled={!isPaid}
                />
              </label>
              {uploadedAssets.length > 0 ? (
                <div className="golf-upload-list">
                  {uploadedAssets.map((asset) => (
                    <div key={asset.id}>
                      <strong>{asset.originalFilename}</strong>
                      <span>
                        {asset.approvedForPublicDisplay
                          ? "Approved for public display"
                          : "Waiting for BGSL review"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              <button
                className="golf-button golf-button-primary"
                disabled={!isPaid}
              >
                Upload Logo
              </button>
            </form>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function UploadNotice({ upload }: { upload?: string }) {
  const message =
    {
      success: "Logo uploaded. BGSL will review it before anything appears publicly.",
      invalid: "That file could not be uploaded. Use PNG, JPG, SVG, WebP, or PDF under 5 MB.",
      missing: "Choose a logo or artwork file before uploading.",
      "setup-pending":
        "Logo upload storage is not configured in this environment yet.",
      unavailable: "Logo upload is available after payment is confirmed.",
    }[upload ?? ""] ?? null;

  if (!message) return null;

  return (
    <div className="golf-alert" role="status">
      {message}
    </div>
  );
}
