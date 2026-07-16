import { NextResponse } from "next/server";

import { db } from "@/db";
import { canManageTeam } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";
import {
  formatGolfPackagePrice,
  getGolfTournamentPackage,
} from "@/lib/golf-tournament/packages";

export async function GET() {
  const viewer = await getViewerContext();

  if (!viewer || !canManageTeam(viewer)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const purchases = await db.query.golfTournamentPurchases.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  const inKindSubmissions =
    await db.query.golfTournamentInKindSubmissions.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
  const players = await db.query.golfTournamentPlayers.findMany({
    orderBy: (table, { asc }) => [asc(table.slotNumber)],
  });
  const assets = await db.query.golfTournamentAssets.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  const rows = [
    [
      "type",
      "package_or_item",
      "buyer_or_donor",
      "email",
      "phone",
      "amount",
      "payment_status",
      "fulfillment_status",
      "sponsor_display_name",
      "sponsor_recognition_name",
      "player_names",
      "logo_files",
      "logo_public_approved",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "created_at",
    ],
    ...purchases.map((purchase) => {
      const packageConfig = getGolfTournamentPackage(purchase.packageId);
      const purchasePlayers = players
        .filter((player) => player.purchaseId === purchase.id)
        .map((player) => player.name)
        .filter(Boolean)
        .join("; ");
      const purchaseAssets = assets.filter(
        (asset) => asset.purchaseId === purchase.id,
      );
      return [
        "purchase",
        packageConfig?.name ?? purchase.packageId,
        purchase.buyerName ?? "",
        purchase.buyerEmail ?? "",
        purchase.buyerPhone ?? "",
        formatGolfPackagePrice(purchase.amountCents),
        purchase.paymentStatus,
        purchase.fulfillmentStatus,
        purchase.sponsorDisplayName ?? "",
        purchase.sponsorRecognitionName ?? "",
        purchasePlayers,
        purchaseAssets.map((asset) => asset.originalFilename).join("; "),
        purchaseAssets.some((asset) => asset.approvedForPublicDisplay)
          ? "yes"
          : "no",
        purchase.stripeCheckoutSessionId ?? "",
        purchase.stripePaymentIntentId ?? "",
        purchase.createdAt.toISOString(),
      ];
    }),
    ...inKindSubmissions.map((submission) => [
      "in-kind",
      submission.itemDescription,
      submission.donorName,
      submission.email,
      submission.phone ?? "",
      "",
      "",
      submission.status,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      submission.createdAt.toISOString(),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        'attachment; filename="bgsl-golf-tournament-export.csv"',
    },
  });
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
