CREATE TABLE "golf_tournament_in_kind_submission_rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_submissions" ADD COLUMN "accepted_email_sent_at" timestamp with time zone;