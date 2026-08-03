import { GoogleAuth } from "google-auth-library";
import { sql } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { env, isGolfSpreadsheetConfigured } from "@/lib/env";
import {
  estimatedStripeFeeCents,
  getGolfTournamentPackage,
} from "@/lib/golf-tournament/packages";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SPREADSHEET_SYNC_LOCK_KEY = "bgsl:golf-tournament-spreadsheet";
const RETRY_DELAYS_MS = [250, 750] as const;
const MAX_SHEETS_REQUEST_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

type CellValue = string | number | boolean;
type ExistingCellValue = CellValue | null;
type SheetTable = {
  title: string;
  headers: string[];
  rows: CellValue[][];
  keyColumns: number[];
};
type SheetValuesResponse = { values?: ExistingCellValue[][] };
type SheetMetadata = {
  sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
};
type ServiceAccountCredentials = {
  client_email?: unknown;
  private_key?: unknown;
  [key: string]: unknown;
};
type GolfQueryDatabase = Pick<typeof db, "query">;

export type GolfSpreadsheetSyncErrorCode =
  | "not-configured"
  | "invalid-config"
  | "auth"
  | "permission-denied"
  | "sheet-not-found"
  | "api"
  | "network"
  | "unknown";

export type GolfSpreadsheetSyncResult = {
  spreadsheetId: string;
  syncedAt: Date;
  rowCount: number;
  sheetCount: number;
};

export class GolfSpreadsheetSyncError extends Error {
  readonly code: GolfSpreadsheetSyncErrorCode;
  readonly status?: number;
  readonly detail?: string;

  constructor(
    code: GolfSpreadsheetSyncErrorCode,
    message: string,
    options?: { status?: number; detail?: string },
  ) {
    super(message);
    this.name = "GolfSpreadsheetSyncError";
    this.code = code;
    this.status = options?.status;
    this.detail = options?.detail;
  }
}

export function getGolfSpreadsheetSyncErrorInfo(error: unknown) {
  if (error instanceof GolfSpreadsheetSyncError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      detail: error.detail,
    };
  }

  return {
    code: "unknown" as const,
    message: error instanceof Error ? error.message : String(error),
  };
}

export async function syncGolfTournamentSpreadsheet(): Promise<GolfSpreadsheetSyncResult> {
  const { spreadsheetId, credentials } = getSpreadsheetConfiguration();
  return db.transaction(async (tx) => {
    // The lock is transaction-scoped so separate Vercel instances cannot
    // overwrite the sheet out of order. The next sync reads the database only
    // after the previous sync has released the lock.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${SPREADSHEET_SYNC_LOCK_KEY}, 0))`,
    );

    return syncGolfTournamentSpreadsheetWithDatabase(
      tx,
      spreadsheetId,
      credentials,
    );
  });
}

async function syncGolfTournamentSpreadsheetWithDatabase(
  database: GolfQueryDatabase,
  spreadsheetId: string,
  credentials: ServiceAccountCredentials,
): Promise<GolfSpreadsheetSyncResult> {
  const tables = await buildGolfTournamentTables(database);

  let headers: Headers;
  try {
    const auth = new GoogleAuth({
      credentials: credentials as object,
      scopes: [SHEETS_SCOPE],
    });
    const client = await auth.getClient();
    headers = await client.getRequestHeaders();
  } catch (error) {
    throw new GolfSpreadsheetSyncError(
      "auth",
      "Google service-account authentication failed.",
      { detail: error instanceof Error ? error.message : String(error) },
    );
  }

  const metadata = await sheetsRequest<SheetMetadata>(
    spreadsheetId,
    "?fields=sheets.properties",
    headers,
  );
  const existingSheets = sheetIdsByTitle(metadata);
  const structureRequests = tables
    .filter((table) => !existingSheets.has(table.title))
    .map((table) => ({ addSheet: { properties: { title: table.title } } }));

  if (structureRequests.length > 0) {
    await sheetsRequest(spreadsheetId, ":batchUpdate", headers, {
      requests: structureRequests,
    });
  }

  const refreshedMetadata = await sheetsRequest<SheetMetadata>(
    spreadsheetId,
    "?fields=sheets.properties",
    headers,
  );
  const sheetIds = sheetIdsByTitle(refreshedMetadata);
  const existingValueRanges = await Promise.all(
    tables.map((table) =>
      sheetsRequest<SheetValuesResponse>(
        spreadsheetId,
        `/values/${encodeURIComponent(`${sheetRange(table.title)}!A:Z`)}`,
        headers,
      ),
    ),
  );
  const mergedTables = tables.map((table, index) =>
    mergeSheetTable(table, existingValueRanges[index]?.values ?? []),
  );
  const valueRanges = mergedTables.map((table) => ({
    range: `${sheetRange(table.title)}!A1`,
    majorDimension: "ROWS" as const,
    values: [table.headers, ...table.rows],
  }));

  await sheetsRequest(spreadsheetId, "/values:batchUpdate", headers, {
    valueInputOption: "RAW",
    data: valueRanges,
  });

  const formatRequests = mergedTables.flatMap((table) => {
    const sheetId = sheetIds.get(table.title);
    if (sheetId === undefined) return [];

    return [
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: table.headers.length,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              textFormat: { bold: true },
              wrapStrategy: "WRAP",
            },
          },
          fields:
            "userEnteredFormat(backgroundColor,textFormat,wrapStrategy)",
        },
      },
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: table.headers.length,
          },
        },
      },
    ];
  });

  await sheetsRequest(spreadsheetId, ":batchUpdate", headers, {
    requests: formatRequests,
  });

  return {
    spreadsheetId,
    syncedAt: new Date(),
    rowCount: tables.reduce((count, table) => count + table.rows.length, 0),
    sheetCount: tables.length,
  };
}

export function scheduleGolfTournamentSpreadsheetSync() {
  if (!isGolfSpreadsheetConfigured()) return;

  try {
    after(async () => {
      try {
        const result = await enqueueAutomaticSpreadsheetSync();
        console.info("[golf-sheet] automatic sync complete", {
          rowCount: result.rowCount,
          sheetCount: result.sheetCount,
        });
      } catch (error) {
        console.error("[golf-sheet] automatic sync failed", {
          ...getGolfSpreadsheetSyncErrorInfo(error),
        });
      }
    });
  } catch (error) {
    console.error("[golf-sheet] could not schedule automatic sync", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

let automaticSpreadsheetSyncQueue: Promise<void> = Promise.resolve();

function enqueueAutomaticSpreadsheetSync() {
  const next = automaticSpreadsheetSyncQueue.then(() =>
    syncGolfTournamentSpreadsheet(),
  );
  automaticSpreadsheetSyncQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function buildGolfTournamentTables(
  database: GolfQueryDatabase = db,
): Promise<SheetTable[]> {
  const [purchases, players, assets, inKind] = await Promise.all([
    database.query.golfTournamentPurchases.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
    database.query.golfTournamentPlayers.findMany({
      orderBy: (table, { asc }) => [asc(table.slotNumber)],
    }),
    database.query.golfTournamentAssets.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
    database.query.golfTournamentInKindSubmissions.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
  ]);

  const paid = purchases.filter((purchase) => purchase.paymentStatus === "PAID");
  const pendingChecks = purchases.filter(
    (purchase) =>
      purchase.paymentMethod === "CHECK" &&
      purchase.paymentStatus === "PENDING",
  );
  const activeSponsors = purchases.filter(
    (purchase) =>
      purchase.purchaseType === "SPONSORSHIP" &&
      (purchase.paymentStatus === "PAID" ||
        (purchase.paymentMethod === "CHECK" &&
          purchase.paymentStatus === "PENDING")),
  );
  const gross = paid.reduce((sum, purchase) => sum + purchase.amountCents, 0);
  const fees = paid
    .filter((purchase) => purchase.paymentMethod === "STRIPE")
    .reduce(
      (sum, purchase) => sum + estimatedStripeFeeCents(purchase.amountCents),
      0,
    );

  return [
    {
      title: "Summary",
      keyColumns: [0],
      headers: ["Metric", "Value"],
      rows: [
        ["Last synced", new Date().toISOString()],
        ["Paid purchases", paid.length],
        ["Pending checks", pendingChecks.length],
        [
          "Pending check receivables",
          pendingChecks.reduce((sum, purchase) => sum + purchase.amountCents, 0) /
            100,
        ],
        ["Gross paid", gross / 100],
        ["Estimated Stripe fees", fees / 100],
        ["Estimated net", (gross - fees) / 100],
        ["Sponsors", activeSponsors.length],
        ["Golfers", players.length],
        ["In-kind submissions", inKind.length],
      ],
    },
    {
      title: "Purchases",
      keyColumns: [0],
      headers: [
        "Purchase ID",
        "Created",
        "Paid",
        "Package",
        "Type",
        "Buyer",
        "Email",
        "Phone",
        "Amount",
        "Payment status",
        "Payment method",
        "Fulfillment status",
        "Stripe checkout session",
        "Stripe payment intent",
        "Confirmation email",
        "Details submitted",
      ],
      rows: purchases.map((purchase) => [
        purchase.id,
        iso(purchase.createdAt),
        iso(purchase.paidAt),
        getGolfTournamentPackage(purchase.packageId)?.name ?? purchase.packageId,
        purchase.purchaseType,
        purchase.buyerName ?? "",
        purchase.buyerEmail ?? "",
        purchase.buyerPhone ?? "",
        purchase.amountCents / 100,
        purchase.paymentStatus,
        purchase.paymentMethod,
        purchase.fulfillmentStatus,
        purchase.stripeCheckoutSessionId ?? "",
        purchase.stripePaymentIntentId ?? "",
        purchase.confirmationEmailStatus,
        iso(purchase.detailsSubmittedAt),
      ]),
    },
    {
      title: "Sponsors",
      keyColumns: [0],
      headers: [
        "Purchase ID",
        "Package",
        "Payment status",
        "Payment method",
        "Amount",
        "Sponsor display name",
        "Recognition name",
        "Contact",
        "Buyer email",
        "Buyer phone",
        "Website",
        "Included golf intent",
        "Public approved",
        "Logo files",
        "Logo approved",
        "Notes",
      ],
      rows: purchases
        .filter((purchase) => purchase.purchaseType === "SPONSORSHIP")
        .map((purchase) => {
          const purchaseAssets = assets.filter(
            (asset) => asset.purchaseId === purchase.id,
          );
          return [
            purchase.id,
            getGolfTournamentPackage(purchase.packageId)?.name ??
              purchase.packageId,
            purchase.paymentStatus,
            purchase.paymentMethod,
            purchase.amountCents / 100,
            purchase.sponsorDisplayName ?? "",
            purchase.sponsorRecognitionName ?? "",
            purchase.sponsorContactName ?? purchase.buyerName ?? "",
            purchase.buyerEmail ?? "",
            purchase.buyerPhone ?? "",
            purchase.sponsorWebsiteUrl ?? "",
            purchase.includedGolfIntent ?? "",
            purchase.approvedForPublicDisplay,
            purchaseAssets.map((asset) => asset.originalFilename).join("; "),
            purchaseAssets.some((asset) => asset.approvedForPublicDisplay),
            purchase.sponsorNotes ?? "",
          ];
        }),
    },
    {
      title: "Golfers",
      keyColumns: [0, 1],
      headers: [
        "Purchase ID",
        "Slot",
        "Package",
        "Golfer name",
        "Golfer email",
        "Buyer",
        "Buyer email",
        "Payment status",
        "Payment method",
      ],
      rows: players.map((player) => {
        const purchase = purchases.find(
          (item) => item.id === player.purchaseId,
        );
        return [
          player.purchaseId,
          player.slotNumber,
          purchase
            ? getGolfTournamentPackage(purchase.packageId)?.name ??
              purchase.packageId
            : "",
          player.name ?? "",
          player.email ?? "",
          purchase?.buyerName ?? "",
          purchase?.buyerEmail ?? "",
          purchase?.paymentStatus ?? "",
          purchase?.paymentMethod ?? "",
        ];
      }),
    },
    {
      title: "Assets",
      keyColumns: [0],
      headers: [
        "Asset ID",
        "Purchase ID",
        "Created",
        "Filename",
        "Content type",
        "Size bytes",
        "Public approved",
        "Storage key",
      ],
      rows: assets.map((asset) => [
        asset.id,
        asset.purchaseId,
        iso(asset.createdAt),
        asset.originalFilename,
        asset.contentType,
        asset.sizeBytes,
        asset.approvedForPublicDisplay,
        asset.r2Key,
      ]),
    },
    {
      title: "In-Kind",
      keyColumns: [0],
      headers: [
        "Submission ID",
        "Created",
        "Donor",
        "Contact",
        "Email",
        "Phone",
        "Item",
        "Estimated value",
        "Status",
        "Pickup notes",
        "Admin notes",
      ],
      rows: inKind.map((submission) => [
        submission.id,
        iso(submission.createdAt),
        submission.donorName,
        submission.contactName,
        submission.email,
        submission.phone ?? "",
        submission.itemDescription,
        submission.estimatedValueCents
          ? submission.estimatedValueCents / 100
          : "",
        submission.status,
        submission.pickupNotes ?? "",
        submission.adminNotes ?? "",
      ]),
    },
  ];
}

function mergeSheetTable(
  table: SheetTable,
  existingValues: ExistingCellValue[][],
): { title: string; headers: ExistingCellValue[]; rows: ExistingCellValue[][] } {
  const existingHeaders = existingValues[0] ?? [];
  const headers = mergeHeaderValues(existingHeaders, table.headers);
  const rows = existingValues.slice(1).map((row) => [...row]);
  const existingRowsByKey = new Map<string, number>();

  rows.forEach((row, index) => {
    const key = getRowKey(row, table.keyColumns);
    if (key && !existingRowsByKey.has(key)) {
      existingRowsByKey.set(key, index);
    }
  });

  for (const incomingRow of table.rows) {
    const key = getRowKey(incomingRow, table.keyColumns);
    const existingRowIndex = key ? existingRowsByKey.get(key) : undefined;

    if (existingRowIndex !== undefined) {
      rows[existingRowIndex] = mergeRowValues(
        rows[existingRowIndex],
        incomingRow,
      );
      continue;
    }

    const nextRowIndex = rows.length;
    rows.push([...incomingRow]);
    if (key) existingRowsByKey.set(key, nextRowIndex);
  }

  return { title: table.title, headers, rows };
}

function mergeHeaderValues(
  existingHeaders: ExistingCellValue[],
  incomingHeaders: string[],
) {
  const headers = [...existingHeaders];
  incomingHeaders.forEach((header, index) => {
    if (isBlankCell(headers[index])) headers[index] = header;
  });
  return headers;
}

function mergeRowValues(
  existingRow: ExistingCellValue[],
  incomingRow: CellValue[],
) {
  const row = [...existingRow];
  incomingRow.forEach((value, index) => {
    // A blank database value must never erase a value someone entered in the
    // sheet. Nonblank database values still refresh the app-owned row.
    if (isBlankCell(row[index]) || !isBlankCell(value)) {
      row[index] = value;
    }
  });
  return row;
}

function getRowKey(
  row: Array<CellValue | null | undefined>,
  keyColumns: number[],
) {
  const keyParts = keyColumns.map((columnIndex) => row[columnIndex]);
  if (keyParts.some(isBlankCell)) return null;
  return keyParts
    .map((value) => String(value).trim().toLowerCase())
    .join("\u001f");
}

function isBlankCell(value: CellValue | null | undefined) {
  return value === null || value === undefined || value === "";
}

function getSpreadsheetConfiguration() {
  const spreadsheetId = env.GOLF_GOOGLE_SHEET_ID.trim();
  const rawCredentials = env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON.trim();

  if (!spreadsheetId || !rawCredentials) {
    throw new GolfSpreadsheetSyncError(
      "not-configured",
      "Spreadsheet sync needs GOLF_GOOGLE_SHEET_ID and GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON.",
    );
  }

  let credentials: ServiceAccountCredentials;
  try {
    credentials = JSON.parse(rawCredentials) as ServiceAccountCredentials;
  } catch {
    throw new GolfSpreadsheetSyncError(
      "invalid-config",
      "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON is not valid JSON.",
    );
  }

  if (
    typeof credentials.client_email !== "string" ||
    typeof credentials.private_key !== "string"
  ) {
    throw new GolfSpreadsheetSyncError(
      "invalid-config",
      "The Google service-account JSON is missing client_email or private_key.",
    );
  }

  return { spreadsheetId, credentials };
}

async function sheetsRequest<T = unknown>(
  spreadsheetId: string,
  suffix: string,
  authHeaders: Headers,
  body?: object,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SHEETS_REQUEST_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(
        `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}${suffix}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            ...Object.fromEntries(authHeaders.entries()),
            ...(body ? { "content-type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        },
      );
    } catch (error) {
      if (attempt < MAX_SHEETS_REQUEST_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }

      throw new GolfSpreadsheetSyncError(
        "network",
        "Could not reach the Google Sheets API.",
        { detail: error instanceof Error ? error.message : String(error) },
      );
    }

    const responseText = await response.text();
    if (!response.ok) {
      const code: GolfSpreadsheetSyncErrorCode =
        response.status === 401
          ? "auth"
          : response.status === 403
            ? "permission-denied"
            : response.status === 404
              ? "sheet-not-found"
              : "api";
      const error = new GolfSpreadsheetSyncError(
        code,
        `Google Sheets API returned ${response.status}.`,
        { status: response.status, detail: responseText.slice(0, 1000) },
      );

      if (
        attempt < MAX_SHEETS_REQUEST_ATTEMPTS &&
        isRetryableSheetsStatus(response.status)
      ) {
        await waitBeforeRetry(attempt);
        continue;
      }

      throw error;
    }

    if (!responseText) return undefined as T;

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new GolfSpreadsheetSyncError(
        "api",
        "Google Sheets API returned an invalid response.",
        { status: response.status, detail: responseText.slice(0, 1000) },
      );
    }
  }

  throw new GolfSpreadsheetSyncError(
    "unknown",
    "Google Sheets sync ended without a response.",
  );
}

function isRetryableSheetsStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function waitBeforeRetry(attempt: number) {
  const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1)!;
  return new Promise<void>((resolve) => setTimeout(resolve, delay));
}

function sheetIdsByTitle(metadata: SheetMetadata) {
  const sheetIds = new Map<string, number>();
  for (const sheet of metadata.sheets ?? []) {
    const title = sheet.properties?.title;
    const sheetId = sheet.properties?.sheetId;
    if (title && typeof sheetId === "number") sheetIds.set(title, sheetId);
  }
  return sheetIds;
}

function sheetRange(title: string) {
  return `'${title.replaceAll("'", "''")}'`;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? "";
}
