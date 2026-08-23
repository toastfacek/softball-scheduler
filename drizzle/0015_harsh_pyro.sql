CREATE TYPE "public"."golf_in_kind_ai_error_code" AS ENUM('HTTP_ERROR', 'INVALID_RESPONSE', 'INVALID_OUTPUT', 'TIMEOUT', 'REQUEST_FAILED');--> statement-breakpoint
CREATE TYPE "public"."golf_in_kind_ai_verdict" AS ENUM('PLAUSIBLE', 'SUSPICIOUS', 'UNCERTAIN');--> statement-breakpoint
CREATE TABLE "golf_tournament_in_kind_ai_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"verdict" "golf_in_kind_ai_verdict" NOT NULL,
	"reason" text NOT NULL,
	"model" text NOT NULL,
	"response_id" text,
	"request_id" text,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"http_status" integer,
	"error_code" "golf_in_kind_ai_error_code",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "golf_tournament_in_kind_ai_reviews" ADD CONSTRAINT "golf_tournament_in_kind_ai_reviews_submission_id_golf_tournament_in_kind_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."golf_tournament_in_kind_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "golf_in_kind_ai_reviews_submission_id_idx" ON "golf_tournament_in_kind_ai_reviews" USING btree ("submission_id");