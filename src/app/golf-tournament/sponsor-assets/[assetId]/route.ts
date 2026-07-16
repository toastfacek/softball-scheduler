import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { golfTournamentPurchases } from "@/db/schema";
import { getGolfTournamentAssetObject } from "@/lib/golf-tournament/storage";

type PublicSponsorAssetRouteProps = {
  params: Promise<{ assetId: string }>;
};

export async function GET(
  _request: Request,
  { params }: PublicSponsorAssetRouteProps,
) {
  const { assetId } = await params;
  const asset = await db.query.golfTournamentAssets.findFirst({
    where: (table) => eq(table.id, assetId),
  });

  if (!asset?.approvedForPublicDisplay) {
    return new NextResponse("Not found", { status: 404 });
  }

  const purchase = await db.query.golfTournamentPurchases.findFirst({
    where: and(
      eq(golfTournamentPurchases.id, asset.purchaseId),
      eq(golfTournamentPurchases.paymentStatus, "PAID"),
      eq(golfTournamentPurchases.approvedForPublicDisplay, true),
    ),
  });

  if (!purchase) {
    return new NextResponse("Not found", { status: 404 });
  }

  const object = await getGolfTournamentAssetObject(asset.r2Key);
  const body = await object.Body?.transformToByteArray();

  if (!body) {
    return new NextResponse("File unavailable", { status: 404 });
  }

  const responseBody = new ArrayBuffer(body.byteLength);
  new Uint8Array(responseBody).set(body);

  return new NextResponse(responseBody, {
    headers: {
      "content-type": asset.contentType,
      "cache-control": "public, max-age=300",
    },
  });
}
