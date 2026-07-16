CREATE TYPE "public"."golf_fulfillment_status" AS ENUM('PAID_NEEDS_DETAILS', 'DETAILS_SUBMITTED', 'NEEDS_REVIEW', 'COMPLETE');--> statement-breakpoint
CREATE TYPE "public"."golf_payment_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."golf_purchase_type" AS ENUM('GOLF', 'SPONSORSHIP');--> statement-breakpoint
CREATE TYPE "public"."in_kind_status" AS ENUM('NEW', 'ACCEPTED', 'NEEDS_FOLLOW_UP', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."included_golf_intent" AS ENUM('WILL_USE', 'WILL_NOT_USE', 'NOT_SURE');--> statement-breakpoint
CREATE TABLE "golf_tournament_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"kind" text DEFAULT 'LOGO' NOT NULL,
	"r2_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"approved_for_public_display" boolean DEFAULT false NOT NULL,
	"approved_public_display_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "golf_tournament_in_kind_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"item_description" text NOT NULL,
	"estimated_value_cents" integer,
	"pickup_notes" text,
	"status" "in_kind_status" DEFAULT 'NEW' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "golf_tournament_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"slot_number" integer NOT NULL,
	"name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "golf_tournament_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" text NOT NULL,
	"purchase_type" "golf_purchase_type" NOT NULL,
	"buyer_name" text,
	"buyer_email" text,
	"buyer_phone" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"payment_status" "golf_payment_status" DEFAULT 'PENDING' NOT NULL,
	"fulfillment_status" "golf_fulfillment_status" DEFAULT 'PAID_NEEDS_DETAILS' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_customer_id" text,
	"completion_token_hash" text NOT NULL,
	"completion_token_expires_at" timestamp with time zone,
	"completion_token_revoked_at" timestamp with time zone,
	"included_golf_intent" "included_golf_intent",
	"sponsor_display_name" text,
	"sponsor_contact_name" text,
	"sponsor_website_url" text,
	"sponsor_recognition_name" text,
	"sponsor_notes" text,
	"approved_for_public_display" boolean DEFAULT false NOT NULL,
	"approved_public_display_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"details_submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "golf_tournament_assets" ADD CONSTRAINT "golf_tournament_assets_purchase_id_golf_tournament_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."golf_tournament_purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golf_tournament_players" ADD CONSTRAINT "golf_tournament_players_purchase_id_golf_tournament_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."golf_tournament_purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "golf_tournament_assets_r2_key" ON "golf_tournament_assets" USING btree ("r2_key");--> statement-breakpoint
CREATE UNIQUE INDEX "golf_tournament_players_purchase_slot_key" ON "golf_tournament_players" USING btree ("purchase_id","slot_number");--> statement-breakpoint
CREATE UNIQUE INDEX "golf_tournament_purchases_session_key" ON "golf_tournament_purchases" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "golf_tournament_purchases_payment_intent_key" ON "golf_tournament_purchases" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "golf_tournament_purchases_completion_token_key" ON "golf_tournament_purchases" USING btree ("completion_token_hash");
