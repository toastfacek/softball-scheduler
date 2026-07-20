ALTER TABLE "golf_tournament_purchases" ADD COLUMN "confirmation_email_status" "delivery_status" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "golf_tournament_purchases" ADD COLUMN "confirmation_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "golf_tournament_purchases" ADD COLUMN "confirmation_email_provider_id" text;--> statement-breakpoint
ALTER TABLE "golf_tournament_purchases" ADD COLUMN "confirmation_email_error" text;