import Link from "next/link";

import {
  resendGolfConfirmationAction,
  resendGolfCompletionLinkAction,
  revokeGolfCompletionLinkAction,
  updateGolfAssetAdminAction,
  updateGolfInKindStatusAction,
  updateGolfPurchaseAdminAction,
} from "@/actions/golf-tournament-actions";
import { signOutGolfAdminAction } from "@/actions/golf-admin-actions";
import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireGolfAdmin } from "@/lib/golf-tournament/admin-auth";
import {
  estimatedStripeFeeCents,
  estimatedStripeNetCents,
  formatGolfPackagePrice,
  getGolfTournamentPackage,
} from "@/lib/golf-tournament/packages";

type GolfTournamentAdminPageProps = {
  searchParams?: Promise<{ saved?: string; view?: string }>;
};

export default async function GolfTournamentAdminPage({
  searchParams,
}: GolfTournamentAdminPageProps) {
  await requireGolfAdmin();
  const params = (await searchParams) ?? {};
  const view = params.view ?? "all";

  const purchases = await db.query.golfTournamentPurchases.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  const inKindSubmissions =
    await db.query.golfTournamentInKindSubmissions.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
  const assets = await db.query.golfTournamentAssets.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  const paidPurchases = purchases.filter(
    (purchase) => purchase.paymentStatus === "PAID",
  );
  const filteredPurchases = purchases.filter((purchase) => {
    if (view === "paid") return purchase.paymentStatus === "PAID";
    if (view === "needs-review") return purchase.fulfillmentStatus === "NEEDS_REVIEW";
    if (view === "needs-details") return purchase.fulfillmentStatus === "PAID_NEEDS_DETAILS";
    if (view === "public") return purchase.approvedForPublicDisplay;
    return true;
  });
  const grossPaid = paidPurchases.reduce(
    (total, purchase) => total + purchase.amountCents,
    0,
  );
  const estimatedFees = paidPurchases.reduce(
    (total, purchase) => total + estimatedStripeFeeCents(purchase.amountCents),
    0,
  );
  const estimatedNet = paidPurchases.reduce(
    (total, purchase) => total + estimatedStripeNetCents(purchase.amountCents),
    0,
  );

  return (
    <div className="golf-admin-dashboard">
      <PageHeader
        title="Golf tournament"
        action={
          <div className="golf-admin-header-actions">
            <Link className="btn-secondary" href="/golf-admin/email-preview">
              Email preview
            </Link>
            <Link className="btn-secondary" href="/settings/golf-tournament/export">
              Export CSV
            </Link>
            <form action={signOutGolfAdminAction}>
              <SubmitButton label="Sign out" />
            </form>
          </div>
        }
      />

      {params.saved ? (
        <div className="saved-flash">Golf tournament changes saved.</div>
      ) : null}

      <section className="settings-grid">
        <SummaryCard label="Gross paid" value={formatGolfPackagePrice(grossPaid)} />
        <SummaryCard
          label="Estimated fees"
          value={formatGolfPackagePrice(estimatedFees)}
        />
        <SummaryCard
          label="Estimated net"
          value={formatGolfPackagePrice(estimatedNet)}
        />
        <SummaryCard label="Paid purchases" value={String(paidPurchases.length)} />
      </section>

      <section className="shell-panel list-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Purchases</p>
            <h2>Registration and sponsorships</h2>
          </div>
        </div>
        <div className="admin-filter-row" aria-label="Golf purchase filters">
          <Link className="btn-secondary" href="/golf-admin">
            All
          </Link>
          <Link className="btn-secondary" href="/golf-admin?view=paid">
            Paid
          </Link>
          <Link
            className="btn-secondary"
            href="/golf-admin?view=needs-details"
          >
            Needs Details
          </Link>
          <Link
            className="btn-secondary"
            href="/golf-admin?view=needs-review"
          >
            Needs Review
          </Link>
          <Link
            className="btn-secondary"
            href="/golf-admin?view=public"
          >
            Public
          </Link>
        </div>
        <div className="linked-list golf-admin-purchase-list">
          {filteredPurchases.length > 0 ? (
            filteredPurchases.map((purchase) => {
              const packageConfig = getGolfTournamentPackage(purchase.packageId);
              const purchaseAssets = assets.filter(
                (asset) => asset.purchaseId === purchase.id,
              );
              return (
                <div key={purchase.id} className="row">
                  <div className="row-grow">
                    <div className="row-title">
                      {packageConfig?.name ?? purchase.packageId}
                    </div>
                    <div className="row-sub">
                      {purchase.buyerName || purchase.buyerEmail || "No buyer details yet"} ·{" "}
                      {purchase.paymentStatus.replaceAll("_", " ")} ·{" "}
                      {purchase.fulfillmentStatus.replaceAll("_", " ")}
                    </div>
                    {purchase.stripeCheckoutSessionId ? (
                      <div className="row-sub">
                        Stripe session: {purchase.stripeCheckoutSessionId}
                      </div>
                    ) : null}
                    <div className="row-sub">
                      Confirmation email: {purchase.confirmationEmailStatus.toLowerCase()}
                      {purchase.confirmationEmailSentAt
                        ? ` · ${purchase.confirmationEmailSentAt.toLocaleString("en-US", { timeZone: "America/New_York" })}`
                        : ""}
                    </div>
                    {purchase.confirmationEmailError ? (
                      <div className="row-sub text-red-700">
                        {purchase.confirmationEmailError}
                      </div>
                    ) : null}
                    {purchaseAssets.length > 0 ? (
                      <div className="admin-asset-list">
                        {purchaseAssets.map((asset) => (
                          <form
                            key={asset.id}
                            action={updateGolfAssetAdminAction}
                            className="admin-asset-row"
                          >
                            <input type="hidden" name="assetId" value={asset.id} />
                            <Link
                              href={`/settings/golf-tournament/assets/${asset.id}`}
                            >
                              {asset.originalFilename}
                            </Link>
                            <label className="admin-checkbox">
                              <input
                                type="checkbox"
                                name="approvedForPublicDisplay"
                                defaultChecked={asset.approvedForPublicDisplay}
                              />
                              Logo public
                            </label>
                            <button className="btn-secondary" type="submit">
                              Save Logo
                            </button>
                          </form>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="admin-purchase-actions">
                    <span className="admin-purchase-price">
                      {formatGolfPackagePrice(purchase.amountCents)}
                    </span>
                    <form
                      action={updateGolfPurchaseAdminAction}
                      className="admin-inline-form"
                    >
                      <input type="hidden" name="purchaseId" value={purchase.id} />
                      <select
                        name="fulfillmentStatus"
                        defaultValue={purchase.fulfillmentStatus}
                        aria-label="Fulfillment status"
                      >
                        <option value="PAID_NEEDS_DETAILS">
                          Paid / needs details
                        </option>
                        <option value="DETAILS_SUBMITTED">
                          Details submitted
                        </option>
                        <option value="NEEDS_REVIEW">Needs review</option>
                        <option value="COMPLETE">Complete</option>
                      </select>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          name="approvedForPublicDisplay"
                          defaultChecked={purchase.approvedForPublicDisplay}
                        />
                        Public
                      </label>
                      <button className="btn-secondary" type="submit">
                        Save
                      </button>
                    </form>
                    <div className="admin-purchase-secondary-actions">
                      <form action={resendGolfCompletionLinkAction}>
                        <input type="hidden" name="purchaseId" value={purchase.id} />
                        <button className="btn-secondary" type="submit">
                          Resend link
                        </button>
                      </form>
                      {purchase.paymentStatus === "PAID" ? (
                        <form action={resendGolfConfirmationAction}>
                          <input type="hidden" name="purchaseId" value={purchase.id} />
                          <button
                            className="btn-secondary"
                            type="submit"
                            disabled={!purchase.buyerEmail}
                          >
                            Send confirmation
                          </button>
                        </form>
                      ) : null}
                      <form action={revokeGolfCompletionLinkAction}>
                        <input type="hidden" name="purchaseId" value={purchase.id} />
                        <button className="btn-ghost" type="submit">
                          Revoke link
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              No golf tournament purchases in this view.
            </div>
          )}
        </div>
      </section>

      <section className="shell-panel list-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Raffle</p>
            <h2>In-kind submissions</h2>
          </div>
        </div>
        <div className="linked-list">
          {inKindSubmissions.length > 0 ? (
            inKindSubmissions.map((submission) => (
              <div key={submission.id} className="row">
                <div className="row-grow">
                  <div className="row-title">{submission.donorName}</div>
                  <div className="row-sub">
                    {submission.itemDescription} · {submission.status.replaceAll("_", " ")}
                  </div>
                </div>
                <form
                  action={updateGolfInKindStatusAction}
                  className="admin-inline-form"
                >
                  <input
                    type="hidden"
                    name="submissionId"
                    value={submission.id}
                  />
                  <select
                    name="status"
                    defaultValue={submission.status}
                    aria-label="In-kind status"
                  >
                    <option value="NEW">New</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="NEEDS_FOLLOW_UP">Needs follow-up</option>
                    <option value="DECLINED">Declined</option>
                  </select>
                  <button className="btn-secondary" type="submit">
                    Save
                  </button>
                </form>
              </div>
            ))
          ) : (
            <div className="empty-state">No raffle or in-kind submissions yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-pill">
      <div className="row-sub">{label}</div>
      <div className="text-2xl font-black text-navy-strong">{value}</div>
    </div>
  );
}
