import Link from "next/link";
import { inArray } from "drizzle-orm";

import {
  discardGolfInKindSubmissionAction,
  markGolfCheckReceivedAction,
  flagSuspiciousGolfInKindSubmissionsAction,
  reconcileGolfStripePaymentsAction,
  resendGolfConfirmationAction,
  resendGolfCompletionLinkAction,
  revokeGolfCompletionLinkAction,
  syncGolfTournamentSpreadsheetAction,
  updateGolfAssetAdminAction,
  updateGolfInKindStatusAction,
  updateGolfPurchaseAdminAction,
} from "@/actions/golf-tournament-actions";
import { signOutGolfAdminAction } from "@/actions/golf-admin-actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import type {
  GolfFulfillmentStatus,
  GolfPaymentStatus,
} from "@/db/schema";
import {
  golfTournamentInKindAiReviews,
  golfTournamentPurchases,
} from "@/db/schema";
import { env, isGolfSpreadsheetConfigured } from "@/lib/env";
import { requireGolfAdmin } from "@/lib/golf-tournament/admin-auth";
import { scanInKindSubmissions } from "@/lib/golf-tournament/in-kind-spam";
import {
  estimatedStripeFeeCents,
  estimatedStripeNetCents,
  formatGolfPackagePrice,
  getGolfTournamentPackage,
} from "@/lib/golf-tournament/packages";

export const maxDuration = 60;

const purchaseViewOrder = [
  "paid",
  "needs-details",
  "needs-review",
  "pending",
  "public",
  "all",
] as const;

type PurchaseView = (typeof purchaseViewOrder)[number];

const purchaseViewLabels: Record<PurchaseView, string> = {
  paid: "Paid",
  "needs-details": "Needs details",
  "needs-review": "Review",
  pending: "Not paid",
  public: "Public",
  all: "All",
};

type GolfPurchase = typeof golfTournamentPurchases.$inferSelect;

type GolfTournamentAdminPageProps = {
  searchParams?: Promise<{
    saved?: string;
    view?: string;
    sync?: string;
    imported?: string;
    updated?: string;
    existing?: string;
    scanned?: string;
    links?: string;
    configuredLinks?: string;
    failed?: string;
    sheetSync?: string;
    rows?: string;
    tabs?: string;
    reason?: string;
    discard?: string;
    scan?: string;
    flagged?: string;
    candidates?: string;
  }>;
};

const spreadsheetSyncMessages: Record<string, string> = {
  "not-configured":
    "Spreadsheet sync is not configured. Add the Google Sheet ID and service-account JSON in Vercel.",
  "invalid-config":
    "Spreadsheet sync configuration is invalid. Check the service-account JSON.",
  auth: "Google authentication failed. Check the service-account key.",
  "permission-denied":
    "Google rejected the request. Share the spreadsheet with the service account's client_email as an Editor.",
  "sheet-not-found":
    "The configured spreadsheet was not found. Check GOLF_GOOGLE_SHEET_ID.",
  network: "Google Sheets could not be reached. Try the sync again.",
  api: "Google Sheets rejected the sync. Check the Vercel runtime log for details.",
  unknown: "Spreadsheet sync failed. Check the Vercel runtime log for details.",
};

export default async function GolfTournamentAdminPage({
  searchParams,
}: GolfTournamentAdminPageProps) {
  await requireGolfAdmin();
  const params = (await searchParams) ?? {};
  const view = isPurchaseView(params.view) ? params.view : "paid";

  const purchases = await db.query.golfTournamentPurchases.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  const allInKindSubmissions =
    await db.query.golfTournamentInKindSubmissions.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
  const openInKindSubmissions = allInKindSubmissions.filter(
    (submission) =>
      submission.status === "NEW" ||
      submission.status === "NEEDS_FOLLOW_UP",
  );
  const inKindSubmissionIds = openInKindSubmissions.map(
    (submission) => submission.id,
  );
  const inKindAiReviews = inKindSubmissionIds.length
    ? await db.query.golfTournamentInKindAiReviews.findMany({
        where: inArray(
          golfTournamentInKindAiReviews.submissionId,
          inKindSubmissionIds,
        ),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      })
    : [];
  const latestInKindAiReviewBySubmission = new Map<
    string,
    (typeof inKindAiReviews)[number]
  >();
  for (const review of inKindAiReviews) {
    if (
      review.submissionId &&
      !latestInKindAiReviewBySubmission.has(review.submissionId)
    ) {
      latestInKindAiReviewBySubmission.set(review.submissionId, review);
    }
  }
  const assets = await db.query.golfTournamentAssets.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  const spamCandidates = scanInKindSubmissions(openInKindSubmissions);
  const flaggableSpamCandidates = spamCandidates.filter(
    (candidate) => candidate.eligibleForFlag,
  );

  const paidPurchases = purchases.filter(
    (purchase) => purchase.paymentStatus === "PAID",
  );
  const filteredPurchases = purchases
    .filter((purchase) => purchaseMatchesView(purchase, view))
    .sort(
      (a, b) =>
        purchaseActivityDate(b).getTime() -
        purchaseActivityDate(a).getTime(),
    );

  const grossPaid = paidPurchases.reduce(
    (total, purchase) => total + purchase.amountCents,
    0,
  );
  const estimatedFees = paidPurchases
    .filter((purchase) => purchase.paymentMethod === "STRIPE")
    .reduce(
    (total, purchase) => total + estimatedStripeFeeCents(purchase.amountCents),
    0,
    );
  const estimatedNet = paidPurchases.reduce(
    (total, purchase) => total + estimatedStripeNetCents(purchase.amountCents),
    0,
  );

  const filters = purchaseViewOrder.map((filterView) => ({
    view: filterView,
    label: purchaseViewLabels[filterView],
    count: purchases.filter((purchase) =>
      purchaseMatchesView(purchase, filterView),
    ).length,
  }));

  return (
    <div className="golf-admin-dashboard">
      <PageHeader
        title="Golf tournament"
        action={
          <div className="golf-admin-header-actions">
            <form action={syncGolfTournamentSpreadsheetAction}>
              <SubmitButton
                label="Sync spreadsheet"
                className="admin-primary-action"
              />
            </form>
            <form action={reconcileGolfStripePaymentsAction}>
              <SubmitButton
                label="Sync Stripe"
                className="admin-primary-action"
              />
            </form>
            <Link
              className="admin-header-link"
              href="/settings/golf-tournament/export"
            >
              Export
            </Link>
            {isGolfSpreadsheetConfigured() ? (
              <Link
                className="admin-header-link"
                href={`https://docs.google.com/spreadsheets/d/${env.GOLF_GOOGLE_SHEET_ID}/edit`}
                target="_blank"
              >
                Spreadsheet
              </Link>
            ) : null}
            <details className="admin-tools-menu">
              <summary>More</summary>
              <div className="admin-tools-menu-panel">
                <Link href="/golf-admin/email-preview">Email preview</Link>
                <form action={signOutGolfAdminAction}>
                  <SubmitButton label="Sign out" />
                </form>
              </div>
            </details>
          </div>
        }
      />

      {params.saved ? (
        <div className="saved-flash">Golf tournament changes saved.</div>
      ) : null}
      {params.discard === "success" ? (
        <div className="saved-flash">
          Submission discarded. It is hidden from the dashboard and retained
          in the audit trail.
        </div>
      ) : null}
      {params.discard === "not-found" ? (
        <div className="saved-flash">
          That submission was already handled or is no longer eligible for
          cleanup.
        </div>
      ) : null}
      {params.sync === "success" ? (
        <div className="saved-flash">
          Stripe sync complete: {params.imported ?? "0"} imported,{" "}
          {params.updated ?? "0"} updated, {params.existing ?? "0"} already in
          the database. Scanned {params.scanned ?? "0"} completed payments
          across {params.links ?? "0"} of {params.configuredLinks ?? "0"} BGSL
          links
          {params.failed && params.failed !== "0"
            ? `; ${params.failed} could not be imported`
            : ""}
          .
        </div>
      ) : null}
      {params.sync === "failed" ? (
        <div className="saved-flash">
          Stripe sync failed. Check the Vercel runtime log for the recorded
          error.
        </div>
      ) : null}
      {params.sync === "not-configured" ? (
        <div className="saved-flash">
          Stripe is not configured for this deployment.
        </div>
      ) : null}
      {params.sheetSync === "success" ? (
        <div className="saved-flash">
          Spreadsheet sync complete: {params.rows ?? "0"} rows across{" "}
          {params.tabs ?? "0"} tabs.
        </div>
      ) : null}
      {params.sheetSync === "failed" ? (
        <div className="saved-flash">
          {spreadsheetSyncMessages[params.reason ?? ""] ??
            spreadsheetSyncMessages.unknown}
        </div>
      ) : null}
      {params.scan === "flagged" ? (
        <div className="saved-flash">
          Flagged {params.flagged ?? "0"} suspicious submission
          {params.flagged === "1" ? "" : "s"} for cleanup review. No records
          were deleted.
        </div>
      ) : null}
      {params.scan === "none" ? (
        <div className="saved-flash">
          No new high-confidence spam matches were found. Existing entries were
          left unchanged.
        </div>
      ) : null}

      <section className="golf-admin-summary" aria-label="Payment summary">
        <SummaryMetric
          label="Gross volume"
          value={formatGolfPackagePrice(grossPaid)}
        />
        <SummaryMetric
          label="Estimated net"
          value={formatGolfPackagePrice(estimatedNet)}
        />
        <SummaryMetric label="Paid" value={String(paidPurchases.length)} />
        <SummaryMetric
          label="Estimated fees"
          value={formatGolfPackagePrice(estimatedFees)}
        />
      </section>

      <section className="golf-admin-ledger">
        <header className="admin-ledger-header">
          <div>
            <p className="eyebrow">Payments</p>
            <h2>Registrations and sponsorships</h2>
          </div>
          <span>
            {filteredPurchases.length}{" "}
            {filteredPurchases.length === 1 ? "record" : "records"}
          </span>
        </header>

        <nav className="admin-filter-tabs" aria-label="Golf purchase filters">
          {filters.map((filter) => {
            const isActive = view === filter.view;
            return (
              <Link
                key={filter.view}
                href={
                  filter.view === "paid"
                    ? "/golf-admin"
                    : `/golf-admin?view=${filter.view}`
                }
                className={isActive ? "is-active" : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                {filter.label}
                <span>{filter.count}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-table-wrap">
          {filteredPurchases.length > 0 ? (
            <table className="admin-purchase-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Purchase</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="admin-amount-heading">
                    Amount
                  </th>
                  <th scope="col">
                    <span className="sr-only">Manage</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => {
                  const packageConfig = getGolfTournamentPackage(
                    purchase.packageId,
                  );
                  const purchaseAssets = assets.filter(
                    (asset) => asset.purchaseId === purchase.id,
                  );
                  const customerName =
                    purchase.buyerName ||
                    purchase.buyerEmail ||
                    "Customer not provided";
                  const showEmail =
                    purchase.buyerEmail &&
                    purchase.buyerEmail !== purchase.buyerName;
                  const purchaseDate =
                    purchase.paymentStatus === "PAID"
                      ? purchase.paidAt
                      : purchase.createdAt;

                  return (
                    <tr key={purchase.id}>
                      <td className="admin-col-customer">
                        <strong>{customerName}</strong>
                        {showEmail ? <span>{purchase.buyerEmail}</span> : null}
                      </td>
                      <td className="admin-col-purchase">
                        <strong>
                          {packageConfig?.name ?? purchase.packageId}
                        </strong>
                        <span>
                          {purchaseActivityLabel(purchase.paymentStatus)}{" "}
                          {formatAdminDate(purchaseDate)}
                        </span>
                      </td>
                      <td className="admin-col-status">
                        <span
                          className={`admin-payment-state admin-payment-state--${purchase.paymentStatus.toLowerCase()}`}
                        >
                          <i aria-hidden="true" />
                          {paymentStatusLabel(purchase.paymentStatus)}
                        </span>
                        <span>
                          {purchase.paymentStatus === "PAID"
                            ? fulfillmentStatusLabel(
                                purchase.fulfillmentStatus,
                              )
                            : nonPaidStatusDetail(purchase.paymentStatus)}
                          {purchase.approvedForPublicDisplay
                            ? " · Public"
                            : ""}
                        </span>
                      </td>
                      <td className="admin-col-amount">
                        {formatGolfPackagePrice(purchase.amountCents)}
                      </td>
                      <td className="admin-col-action">
                        <details className="admin-row-menu">
                          <summary
                            aria-label={`Manage ${customerName}'s purchase`}
                          >
                            <span aria-hidden="true">•••</span>
                          </summary>
                          <div className="admin-row-menu-panel">
                            <div className="admin-row-menu-heading">
                              <strong>Manage purchase</strong>
                              <span>
                                {purchase.stripeCheckoutSessionId
                                  ? `Stripe ${purchase.stripeCheckoutSessionId.slice(-10)}`
                                  : "No Stripe session"}
                              </span>
                            </div>

                            <form
                              action={updateGolfPurchaseAdminAction}
                              className="admin-manage-form"
                            >
                              <input
                                type="hidden"
                                name="purchaseId"
                                value={purchase.id}
                              />
                              <label>
                                Details status
                                <select
                                  name="fulfillmentStatus"
                                  defaultValue={purchase.fulfillmentStatus}
                                >
                                  <option value="PAID_NEEDS_DETAILS">
                                    Needs details
                                  </option>
                                  <option value="DETAILS_SUBMITTED">
                                    Details submitted
                                  </option>
                                  <option value="NEEDS_REVIEW">
                                    Needs review
                                  </option>
                                  <option value="COMPLETE">Complete</option>
                                </select>
                              </label>
                              <label className="admin-checkbox">
                                <input
                                  type="checkbox"
                                  name="approvedForPublicDisplay"
                                  defaultChecked={
                                    purchase.approvedForPublicDisplay
                                  }
                                />
                                Show publicly
                              </label>
                              <button type="submit">Save changes</button>
                            </form>

                            <div className="admin-row-menu-actions">
                              {purchase.paymentMethod === "CHECK" &&
                              purchase.paymentStatus === "PENDING" ? (
                                <form action={markGolfCheckReceivedAction}>
                                  <input
                                    type="hidden"
                                    name="purchaseId"
                                    value={purchase.id}
                                  />
                                  <button type="submit">
                                    Mark check received
                                  </button>
                                </form>
                              ) : null}
                              <form action={resendGolfCompletionLinkAction}>
                                <input
                                  type="hidden"
                                  name="purchaseId"
                                  value={purchase.id}
                                />
                                <button
                                  type="submit"
                                  disabled={!purchase.buyerEmail}
                                >
                                  Send details link
                                </button>
                              </form>
                              {purchase.paymentStatus === "PAID" ? (
                                <form action={resendGolfConfirmationAction}>
                                  <input
                                    type="hidden"
                                    name="purchaseId"
                                    value={purchase.id}
                                  />
                                  <button
                                    type="submit"
                                    disabled={!purchase.buyerEmail}
                                  >
                                    Send confirmation
                                  </button>
                                </form>
                              ) : null}
                              <form action={revokeGolfCompletionLinkAction}>
                                <input
                                  type="hidden"
                                  name="purchaseId"
                                  value={purchase.id}
                                />
                                <button type="submit">Revoke details link</button>
                              </form>
                            </div>

                            <div className="admin-row-menu-meta">
                              {purchase.buyerPhone ? (
                                <span>Phone: {purchase.buyerPhone}</span>
                              ) : null}
                              <span>
                                Email:{" "}
                                {purchase.confirmationEmailStatus.toLowerCase()}
                                {purchase.confirmationEmailSentAt
                                  ? ` · ${formatAdminDate(
                                      purchase.confirmationEmailSentAt,
                                    )}`
                                  : ""}
                              </span>
                              {purchase.confirmationEmailError ? (
                                <span className="text-red-700">
                                  {purchase.confirmationEmailError}
                                </span>
                              ) : null}
                            </div>

                            {purchaseAssets.length > 0 ? (
                              <div className="admin-menu-assets">
                                <strong>Files</strong>
                                {purchaseAssets.map((asset) => (
                                  <form
                                    key={asset.id}
                                    action={updateGolfAssetAdminAction}
                                    className="admin-menu-asset"
                                  >
                                    <input
                                      type="hidden"
                                      name="assetId"
                                      value={asset.id}
                                    />
                                    <Link
                                      href={`/settings/golf-tournament/assets/${asset.id}`}
                                    >
                                      {asset.originalFilename}
                                    </Link>
                                    <label className="admin-checkbox">
                                      <input
                                        type="checkbox"
                                        name="approvedForPublicDisplay"
                                        defaultChecked={
                                          asset.approvedForPublicDisplay
                                        }
                                      />
                                      Public
                                    </label>
                                    <button type="submit">Save</button>
                                  </form>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="admin-table-empty">
              No purchases match this filter.
            </div>
          )}
        </div>
      </section>

      <details
        className="golf-admin-secondary-ledger"
        open={openInKindSubmissions.length > 0}
      >
        <summary>
          <span>
            <span className="eyebrow">Raffle</span>
            <strong>In-kind review queue</strong>
          </span>
          <span>{openInKindSubmissions.length}</span>
        </summary>
        <div className="admin-secondary-content">
          {openInKindSubmissions.length > 0 ? (
            openInKindSubmissions.map((submission) => {
              const aiReview = latestInKindAiReviewBySubmission.get(submission.id);
              return (
                <div key={submission.id} className="admin-secondary-row">
                  <div>
                    <strong>{submission.donorName}</strong>
                    <span>
                      {submission.itemDescription} ·{" "}
                      {submission.status.replaceAll("_", " ")}
                    </span>
                    {aiReview ? (
                      <small>
                        Screening: {aiReview.screeningOutcome.replaceAll("_", " ").toLowerCase()}
                        {aiReview.attemptCount > 1
                          ? ` · ${aiReview.attemptCount} judge attempts`
                          : ""}
                        {aiReview.emailError ? ` · email: ${aiReview.emailError}` : ""}
                        {aiReview.reason ? ` · ${aiReview.reason}` : ""}
                      </small>
                    ) : null}
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
                    <button type="submit">Save</button>
                  </form>
                </div>
              );
            })
          ) : (
            <p>No open raffle or in-kind submissions.</p>
          )}
        </div>
      </details>

      <details
        className="golf-admin-cleanup"
        open={Boolean(params.scan || params.discard)}
      >
        <summary>
          <span>
            <span className="eyebrow">Maintenance</span>
            <strong>Suspicious submissions</strong>
          </span>
          <span
            className={
              spamCandidates.length > 0
                ? "golf-admin-cleanup-count has-items"
                : "golf-admin-cleanup-count"
            }
          >
            {spamCandidates.length > 0
              ? `${spamCandidates.length} to review`
              : "Clear"}
          </span>
        </summary>
        <section
          className="golf-admin-spam-review"
          aria-labelledby="spam-review-title"
        >
          <header className="admin-spam-review-header">
            <div className="admin-spam-review-copy">
              <p className="eyebrow">Cleanup review</p>
              <h2 id="spam-review-title">Review suspicious submissions</h2>
              <p>
                This conservative scan looks for obvious test data, spam links
                or language, and repeated submissions. It never deletes records
                or contacts donors; it flags matches for discard review.
                Discarding hides a row while retaining its audit trail.
              </p>
            </div>
            <form action={flagSuspiciousGolfInKindSubmissionsAction}>
              <SubmitButton
                label={
                  flaggableSpamCandidates.length > 0
                    ? `Flag ${flaggableSpamCandidates.length} for cleanup`
                    : "Run scan again"
                }
                pendingLabel="Scanning..."
                className="admin-primary-action"
              />
            </form>
          </header>
          {spamCandidates.length > 0 ? (
            <div className="admin-spam-list">
              {spamCandidates.map((candidate) => (
                <div
                  key={candidate.submission.id}
                  className="admin-spam-row"
                >
                  <div className="admin-spam-submission">
                    <strong>{candidate.submission.donorName}</strong>
                    <span>{candidate.submission.email}</span>
                    <span>
                      {candidate.submission.itemDescription} ·{" "}
                      {formatAdminDate(candidate.submission.createdAt)}
                    </span>
                  </div>
                  <div className="admin-spam-meta">
                    <div className="admin-spam-reasons">
                      {candidate.reasons.map((reason) => (
                        <span key={reason} className="admin-spam-reason">
                          {reason}
                        </span>
                      ))}
                    </div>
                    <div className="admin-spam-actions">
                      <span className="admin-spam-state">
                        {candidate.eligibleForFlag
                          ? "Ready to flag"
                          : "Flagged for discard review"}
                      </span>
                      <form
                        action={discardGolfInKindSubmissionAction}
                        className="admin-spam-discard-form"
                      >
                        <input
                          type="hidden"
                          name="submissionId"
                          value={candidate.submission.id}
                        />
                        <SubmitButton
                          label="Discard"
                          pendingLabel="Discarding..."
                          className="admin-spam-discard-button"
                        />
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-spam-empty">
              No high-confidence matches found in the current submissions.
            </div>
          )}
        </section>
      </details>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function isPurchaseView(value?: string): value is PurchaseView {
  return purchaseViewOrder.includes(value as PurchaseView);
}

function purchaseMatchesView(
  purchase: GolfPurchase,
  view: PurchaseView,
) {
  switch (view) {
    case "paid":
      return purchase.paymentStatus === "PAID";
    case "needs-details":
      return (
        purchase.paymentStatus === "PAID" &&
        purchase.fulfillmentStatus === "PAID_NEEDS_DETAILS"
      );
    case "needs-review":
      return (
        purchase.paymentStatus === "PAID" &&
        purchase.fulfillmentStatus === "NEEDS_REVIEW"
      );
    case "pending":
      return purchase.paymentStatus === "PENDING";
    case "public":
      return (
        purchase.paymentStatus === "PAID" &&
        purchase.approvedForPublicDisplay
      );
    case "all":
      return true;
  }
}

function paymentStatusLabel(status: GolfPaymentStatus) {
  switch (status) {
    case "PENDING":
      return "Checkout started";
    case "PAID":
      return "Paid";
    case "FAILED":
      return "Failed";
    case "CANCELED":
      return "Canceled";
    case "REFUNDED":
      return "Refunded";
  }
}

function fulfillmentStatusLabel(status: GolfFulfillmentStatus) {
  switch (status) {
    case "PAID_NEEDS_DETAILS":
      return "Needs details";
    case "DETAILS_SUBMITTED":
      return "Details submitted";
    case "NEEDS_REVIEW":
      return "Needs review";
    case "COMPLETE":
      return "Complete";
  }
}

function purchaseActivityLabel(status: GolfPaymentStatus) {
  switch (status) {
    case "PENDING":
      return "Started";
    case "PAID":
      return "Paid";
    case "FAILED":
      return "Failed";
    case "CANCELED":
      return "Canceled";
    case "REFUNDED":
      return "Refunded";
  }
}

function nonPaidStatusDetail(status: GolfPaymentStatus) {
  switch (status) {
    case "PAID":
      return "Payment received";
    case "PENDING":
      return "No payment received";
    case "FAILED":
      return "Payment failed";
    case "CANCELED":
      return "Checkout canceled";
    case "REFUNDED":
      return "Payment returned";
  }
}

function formatAdminDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(value);
}

function purchaseActivityDate(purchase: {
  paymentStatus: GolfPaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
}) {
  return purchase.paymentStatus === "PAID" && purchase.paidAt
    ? purchase.paidAt
    : purchase.createdAt;
}
