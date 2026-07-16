import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env, isR2Configured } from "@/lib/env";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "application/pdf",
]);

let client: S3Client | null = null;

function r2Client() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return client;
}

export function validateLogoFile(file: File) {
  if (file.size <= 0) return "Choose a logo or artwork file first.";
  if (file.size > MAX_LOGO_BYTES) return "Logo files must be 5 MB or smaller.";
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return "Upload a PNG, JPG, SVG, WebP, or PDF file.";
  }

  return null;
}

export function logoObjectKey({
  purchaseId,
  filename,
}: {
  purchaseId: string;
  filename: string;
}) {
  const extension = filename.split(".").pop()?.toLowerCase() || "bin";
  return `golf-tournament/2026/${purchaseId}/logo-original.${extension}`;
}

export async function uploadGolfTournamentLogo({
  key,
  file,
}: {
  key: string;
  file: File;
}) {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured.");
  }

  await r2Client().send(
    new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    }),
  );
}

export async function getGolfTournamentAssetObject(key: string) {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured.");
  }

  return r2Client().send(
    new GetObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET,
      Key: key,
    }),
  );
}
