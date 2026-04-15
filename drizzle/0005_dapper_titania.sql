ALTER TYPE "public"."reminder_type" ADD VALUE 'NON_RESPONDER_24H_SMS';--> statement-breakpoint
ALTER TYPE "public"."response_source" ADD VALUE 'IMESSAGE';--> statement-breakpoint
CREATE TABLE "text_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"event_id" uuid,
	"created_by_user_id" uuid,
	"kind" "email_kind" NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "text_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text_message_id" uuid NOT NULL,
	"user_id" uuid,
	"player_id" uuid,
	"phone" text NOT NULL,
	"delivery_status" "delivery_status" DEFAULT 'PENDING' NOT NULL,
	"provider_message_id" text,
	"delivered_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adult_users" ADD COLUMN "text_opt_in" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD COLUMN "text_recipient_id" uuid;--> statement-breakpoint
ALTER TABLE "text_messages" ADD CONSTRAINT "text_messages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_messages" ADD CONSTRAINT "text_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_messages" ADD CONSTRAINT "text_messages_created_by_user_id_adult_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."adult_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_recipients" ADD CONSTRAINT "text_recipients_text_message_id_text_messages_id_fk" FOREIGN KEY ("text_message_id") REFERENCES "public"."text_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_recipients" ADD CONSTRAINT "text_recipients_user_id_adult_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."adult_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_recipients" ADD CONSTRAINT "text_recipients_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "text_recipients_message_phone_key" ON "text_recipients" USING btree ("text_message_id","phone");--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_text_recipient_id_text_recipients_id_fk" FOREIGN KEY ("text_recipient_id") REFERENCES "public"."text_recipients"("id") ON DELETE set null ON UPDATE no action;