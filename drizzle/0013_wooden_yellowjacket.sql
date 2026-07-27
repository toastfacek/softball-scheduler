DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_type
		WHERE typname = 'golf_payment_method'
	) THEN
		CREATE TYPE "public"."golf_payment_method" AS ENUM('STRIPE', 'CHECK');
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "golf_tournament_purchases"
	ADD COLUMN IF NOT EXISTS "payment_method" "golf_payment_method" DEFAULT 'STRIPE' NOT NULL;--> statement-breakpoint
INSERT INTO "golf_tournament_purchases" (
	"id",
	"package_id",
	"purchase_type",
	"amount_cents",
	"currency",
	"payment_status",
	"payment_method",
	"fulfillment_status",
	"completion_token_hash",
	"completion_token_expires_at",
	"completion_token_revoked_at",
	"included_golf_intent",
	"sponsor_display_name",
	"sponsor_recognition_name",
	"sponsor_notes"
) SELECT
	'c2050000-0000-4000-8000-000000000001',
	'grab-go-lunch-sponsor',
	'SPONSORSHIP',
	220000,
	'usd',
	'PENDING',
	'CHECK',
	'PAID_NEEDS_DETAILS',
	'offline-check-cross-insurance-grab-go-2026',
	now(),
	now(),
	'NOT_SURE',
	'Cross Insurance',
	'Cross Insurance',
	'Payment committed by check; awaiting receipt.'
WHERE NOT EXISTS (
	SELECT 1
	FROM "golf_tournament_purchases"
	WHERE "package_id" = 'grab-go-lunch-sponsor'
		AND lower(COALESCE("sponsor_display_name", "sponsor_recognition_name", '')) = 'cross insurance'
)
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "golf_tournament_purchases"
SET
	"payment_method" = 'CHECK',
	"sponsor_display_name" = COALESCE("sponsor_display_name", 'Cross Insurance'),
	"sponsor_recognition_name" = COALESCE("sponsor_recognition_name", 'Cross Insurance'),
	"sponsor_notes" = COALESCE("sponsor_notes", 'Payment committed by check; awaiting receipt.'),
	"updated_at" = now()
WHERE "package_id" = 'grab-go-lunch-sponsor'
	AND lower(COALESCE("sponsor_display_name", "sponsor_recognition_name", '')) = 'cross insurance'
	AND "payment_status" IN ('PENDING', 'PAID');--> statement-breakpoint
INSERT INTO "golf_tournament_players" (
	"id",
	"purchase_id",
	"slot_number"
) SELECT
	CASE slot."number"
		WHEN 1 THEN 'a2050000-0000-4000-8000-000000000001'::uuid
		WHEN 2 THEN 'a2050000-0000-4000-8000-000000000002'::uuid
		WHEN 3 THEN 'a2050000-0000-4000-8000-000000000003'::uuid
		ELSE 'a2050000-0000-4000-8000-000000000004'::uuid
	END,
	purchase."id",
	slot."number"
FROM "golf_tournament_purchases" purchase
CROSS JOIN generate_series(1, 4) AS slot("number")
WHERE purchase."package_id" = 'grab-go-lunch-sponsor'
	AND lower(COALESCE(purchase."sponsor_display_name", purchase."sponsor_recognition_name", '')) = 'cross insurance'
ON CONFLICT DO NOTHING;
