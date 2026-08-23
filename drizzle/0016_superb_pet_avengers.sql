ALTER TABLE "golf_tournament_in_kind_ai_reviews" ALTER COLUMN "submission_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "screening_outcome" text DEFAULT 'REVIEW' NOT NULL;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "judge_status" text DEFAULT 'NOT_RUN' NOT NULL;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "deterministic_score" integer;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "deterministic_reasons" jsonb;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "input_fingerprint" text;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "email_attempted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "email_provider_id" text;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "email_error" text;
--> statement-breakpoint
UPDATE "golf_tournament_in_kind_ai_reviews"
SET
	"screening_outcome" = CASE "verdict"
		WHEN 'PLAUSIBLE' THEN 'CLEAR'
		WHEN 'SUSPICIOUS' THEN 'SPAM'
		ELSE 'REVIEW'
	END,
	"judge_status" = CASE
		WHEN "error_code" IS NULL THEN 'SUCCEEDED'
		ELSE 'FAILED'
	END,
	"attempt_count" = 1;
