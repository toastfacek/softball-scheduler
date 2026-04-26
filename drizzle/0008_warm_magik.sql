ALTER TABLE "adult_users" ADD COLUMN "calendar_sync_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "adult_users_calendar_sync_token_key" ON "adult_users" USING btree ("calendar_sync_token");