CREATE TYPE "public"."golf_in_kind_judge_status" AS ENUM('NOT_RUN', 'SUCCEEDED', 'SKIPPED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."golf_in_kind_screening_outcome" AS ENUM('SPAM', 'REVIEW', 'CLEAR', 'JUDGE_UNAVAILABLE');--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ALTER COLUMN "screening_outcome" SET DEFAULT 'REVIEW'::"public"."golf_in_kind_screening_outcome";--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ALTER COLUMN "screening_outcome" SET DATA TYPE "public"."golf_in_kind_screening_outcome" USING "screening_outcome"::"public"."golf_in_kind_screening_outcome";--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ALTER COLUMN "judge_status" SET DEFAULT 'NOT_RUN'::"public"."golf_in_kind_judge_status";--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ALTER COLUMN "judge_status" SET DATA TYPE "public"."golf_in_kind_judge_status" USING "judge_status"::"public"."golf_in_kind_judge_status";--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "attempt_log" jsonb;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "quarantine_donor_name" text;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "quarantine_email" text;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "quarantine_item_description" text;--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD COLUMN "quarantine_until" timestamp with time zone;