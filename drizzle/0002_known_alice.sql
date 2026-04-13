CREATE TABLE "lineup_preset_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" uuid NOT NULL,
	"inning_number" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"position_template_id" uuid,
	"position_code" text NOT NULL,
	"position_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineup_preset_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"slot_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineup_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"innings_count" integer DEFAULT 6 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lineup_preset_assignments" ADD CONSTRAINT "lineup_preset_assignments_preset_id_lineup_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."lineup_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_preset_assignments" ADD CONSTRAINT "lineup_preset_assignments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_preset_assignments" ADD CONSTRAINT "lineup_preset_assignments_position_template_id_team_position_templates_id_fk" FOREIGN KEY ("position_template_id") REFERENCES "public"."team_position_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_preset_slots" ADD CONSTRAINT "lineup_preset_slots_preset_id_lineup_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."lineup_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_preset_slots" ADD CONSTRAINT "lineup_preset_slots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_presets" ADD CONSTRAINT "lineup_presets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_presets" ADD CONSTRAINT "lineup_presets_created_by_user_id_adult_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."adult_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lineup_preset_assignments_preset_inning_player_key" ON "lineup_preset_assignments" USING btree ("preset_id","inning_number","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lineup_preset_slots_preset_slot_key" ON "lineup_preset_slots" USING btree ("preset_id","slot_number");--> statement-breakpoint
CREATE UNIQUE INDEX "lineup_preset_slots_preset_player_key" ON "lineup_preset_slots" USING btree ("preset_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lineup_presets_team_name_key" ON "lineup_presets" USING btree ("team_id","name");