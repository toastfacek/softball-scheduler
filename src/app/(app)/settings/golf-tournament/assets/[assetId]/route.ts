import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { canManageTeam } from "@/lib/authz";
import { getViewerContext } from "@/lib/data";
import { getGolfTournamentAssetObject } from "@/lib/golf-tournament/storage";

type AssetRouteProps = {
  params: Promise<{ assetId: string }>;
};

export async function GET(_request: Request, { params }: AssetRouteProps) {
  const viewer = await getViewerContext();

  if (!viewer || !canManageTeam(viewer)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { assetId } = await params;
  const asset = await db.query.golfTournamentAssets.findFirst({
    where: (table) => eq(table.id, assetId),
  });

  if (!asset) {
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
      "content-disposition": `attachment; filename="${asset.originalFilename.replaceAll('"', "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
