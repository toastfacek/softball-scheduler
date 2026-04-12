CREATE TYPE "public"."actual_attendance" AS ENUM('UNKNOWN', 'PRESENT', 'ABSENT');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('AVAILABLE', 'UNAVAILABLE', 'MAYBE');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."email_kind" AS ENUM('INVITE', 'BROADCAST', 'REMINDER');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('SCHEDULED', 'CANCELED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('GAME', 'PRACTICE');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('NON_RESPONDER_24H');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('PARENT', 'COACH', 'ADMIN');--> statement-breakpoint
CREATE TABLE "adult_event_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"note" text,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actual_attendance" "actual_attendance" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adult_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"phone" text,
	"reminder_opt_in" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	"refresh_token_expires_in" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batting_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lineup_plan_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"slot_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"event_id" uuid,
	"created_by_user_id" uuid,
	"kind" "email_kind" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_message_id" uuid NOT NULL,
	"user_id" uuid,
	"player_id" uuid,
	"email" text NOT NULL,
	"delivery_status" "delivery_status" DEFAULT 'PENDING' NOT NULL,
	"provider_message_id" text,
	"delivered_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"season_id" uuid,
	"type" "event_type" NOT NULL,
	"status" "event_status" DEFAULT 'SCHEDULED' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"venue_name" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inning_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lineup_plan_id" uuid NOT NULL,
	"inning_number" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"position_template_id" uuid,
	"position_code" text NOT NULL,
	"position_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineup_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"innings_count" integer DEFAULT 6 NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_event_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"note" text,
	"responded_by_user_id" uuid,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actual_attendance" "actual_attendance" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"relationship_label" text DEFAULT 'Guardian' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"season_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"jersey_number" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"email_recipient_id" uuid,
	"reminder_type" "reminder_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_position_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"city" text DEFAULT 'Beverly' NOT NULL,
	"state" text DEFAULT 'MA' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"primary_color" text DEFAULT '#1f3157' NOT NULL,
	"secondary_color" text DEFAULT '#f28f3b' NOT NULL,
	"accent_color" text DEFAULT '#6bb8c7' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "adult_event_responses" ADD CONSTRAINT "adult_event_responses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adult_event_responses" ADD CONSTRAINT "adult_event_responses_user_id_adult_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."adult_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_adult_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."adult_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_adult_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."adult_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batting_slots" ADD CONSTRAINT "batting_slots_lineup_plan_id_lineup_plans_id_fk" FOREIGN KEY ("lineup_plan_id") REFERENCES "public"."lineup_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batting_slots" ADD CONSTRAINT "batting_slots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_created_by_user_id_adult_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."adult_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_recipients" ADD CONSTRAINT "email_recipients_email_message_id_email_messages_id_fk" FOREIGN KEY ("email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_recipients" ADD CONSTRAINT "email_recipients_user_id_adult_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."adult_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_recipients" ADD CONSTRAINT "email_recipients_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inning_assignments" ADD CONSTRAINT "inning_assignments_lineup_plan_id_lineup_plans_id_fk" FOREIGN KEY ("lineup_plan_id") REFERENCES "public"."lineup_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inning_assignments" ADD CONSTRAINT "inning_assignments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inning_assignments" ADD CONSTRAINT "inning_assignments_position_template_id_team_position_templates_id_fk" FOREIGN KEY ("position_template_id") REFERENCES "public"."team_position_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_plans" ADD CONSTRAINT "lineup_plans_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_plans" ADD CONSTRAINT "lineup_plans_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_plans" ADD CONSTRAINT "lineup_plans_updated_by_user_id_adult_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."adult_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_event_responses" ADD CONSTRAINT "player_event_responses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_event_responses" ADD CONSTRAINT "player_event_responses_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_event_responses" ADD CONSTRAINT "player_event_responses_responded_by_user_id_adult_users_id_fk" FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."adult_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_guardians" ADD CONSTRAINT "player_guardians_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_guardians" ADD CONSTRAINT "player_guardians_user_id_adult_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."adult_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_user_id_adult_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."adult_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_email_recipient_id_email_recipients_id_fk" FOREIGN KEY ("email_recipient_id") REFERENCES "public"."email_recipients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_adult_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."adult_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_position_templates" ADD CONSTRAINT "team_position_templates_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adult_event_responses_event_user_key" ON "adult_event_responses" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "adult_users_email_key" ON "adult_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_session_token_key" ON "auth_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE UNIQUE INDEX "batting_slots_plan_slot_key" ON "batting_slots" USING btree ("lineup_plan_id","slot_number");--> statement-breakpoint
CREATE UNIQUE INDEX "batting_slots_plan_player_key" ON "batting_slots" USING btree ("lineup_plan_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_recipients_message_email_key" ON "email_recipients" USING btree ("email_message_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "inning_assignments_plan_inning_player_key" ON "inning_assignments" USING btree ("lineup_plan_id","inning_number","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lineup_plans_event_key" ON "lineup_plans" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_event_responses_event_player_key" ON "player_event_responses" USING btree ("event_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_guardians_player_user_key" ON "player_guardians" USING btree ("player_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_deliveries_event_user_type_key" ON "reminder_deliveries" USING btree ("event_id","user_id","reminder_type");--> statement-breakpoint
CREATE UNIQUE INDEX "team_memberships_team_user_role_key" ON "team_memberships" USING btree ("team_id","user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "team_position_templates_team_code_key" ON "team_position_templates" USING btree ("team_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_slug_key" ON "teams" USING btree ("slug");