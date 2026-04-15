import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", {
  withTimezone: true,
  mode: "date",
})
  .defaultNow()
  .notNull();

const updatedAt = timestamp("updated_at", {
  withTimezone: true,
  mode: "date",
})
  .defaultNow()
  .notNull();

export const teamRoleEnum = pgEnum("team_role", ["PARENT", "COACH", "ADMIN"]);
export const eventTypeEnum = pgEnum("event_type", ["GAME", "PRACTICE"]);
export const eventStatusEnum = pgEnum("event_status", [
  "SCHEDULED",
  "CANCELED",
  "COMPLETED",
]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "AVAILABLE",
  "UNAVAILABLE",
  "MAYBE",
]);
export const actualAttendanceEnum = pgEnum("actual_attendance", [
  "UNKNOWN",
  "PRESENT",
  "ABSENT",
]);
export const emailKindEnum = pgEnum("email_kind", [
  "INVITE",
  "BROADCAST",
  "REMINDER",
]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "PENDING",
  "SENT",
  "FAILED",
]);
export const reminderTypeEnum = pgEnum("reminder_type", [
  "NON_RESPONDER_24H",
  "NON_RESPONDER_24H_SMS",
]);
export const responseSourceEnum = pgEnum("response_source", [
  "APP",
  "EMAIL_LINK",
  "COACH_MANUAL",
  "IMESSAGE",
]);

export const adultUsers = pgTable(
  "adult_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", {
      withTimezone: true,
      mode: "date",
    }),
    image: text("image"),
    phone: text("phone"),
    reminderOptIn: boolean("reminder_opt_in").default(true).notNull(),
    textOptIn: boolean("text_opt_in").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("adult_users_email_key").on(table.email)],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => adultUsers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
    refresh_token_expires_in: integer("refresh_token_expires_in"),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.providerAccountId],
      name: "auth_accounts_provider_provider_account_id_pk",
    }),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adultUsers.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("auth_sessions_session_token_key").on(table.sessionToken)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
      name: "verification_tokens_identifier_token_pk",
    }),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    brandSubtitle: text("brand_subtitle"),
    slug: text("slug").notNull(),
    city: text("city").default("Beverly").notNull(),
    state: text("state").default("MA").notNull(),
    timezone: text("timezone").default("America/New_York").notNull(),
    primaryColor: text("primary_color").default("#1f3157").notNull(),
    secondaryColor: text("secondary_color").default("#f28f3b").notNull(),
    accentColor: text("accent_color").default("#6bb8c7").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("teams_slug_key").on(table.slug)],
);

export const seasons = pgTable("seasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  startDate: timestamp("start_date", { withTimezone: true, mode: "date" }),
  endDate: timestamp("end_date", { withTimezone: true, mode: "date" }),
  createdAt,
  updatedAt,
});

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => adultUsers.id, { onDelete: "cascade" }),
    role: teamRoleEnum("role").notNull(),
    title: text("title"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("team_memberships_team_user_role_key").on(
      table.teamId,
      table.userId,
      table.role,
    ),
  ],
);

export const teamPositionTemplates = pgTable(
  "team_position_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("team_position_templates_team_code_key").on(table.teamId, table.code)],
);

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredName: text("preferred_name"),
  jerseyNumber: integer("jersey_number"),
  notes: text("notes"),
  createdAt,
  updatedAt,
});

export const playerGuardians = pgTable(
  "player_guardians",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => adultUsers.id, { onDelete: "cascade" }),
    relationshipLabel: text("relationship_label").default("Guardian").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("player_guardians_player_user_key").on(table.playerId, table.userId),
  ],
);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "set null" }),
  type: eventTypeEnum("type").notNull(),
  status: eventStatusEnum("status").default("SCHEDULED").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
  timezone: text("timezone").default("America/New_York").notNull(),
  venueName: text("venue_name"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  createdAt,
  updatedAt,
});

export const playerEventResponses = pgTable(
  "player_event_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    note: text("note"),
    respondedByUserId: uuid("responded_by_user_id").references(() => adultUsers.id, {
      onDelete: "set null",
    }),
    respondedAt: timestamp("responded_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    actualAttendance: actualAttendanceEnum("actual_attendance")
      .default("UNKNOWN")
      .notNull(),
    responseSource: responseSourceEnum("response_source")
      .default("APP")
      .notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("player_event_responses_event_player_key").on(table.eventId, table.playerId)],
);

export const adultEventResponses = pgTable(
  "adult_event_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => adultUsers.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    note: text("note"),
    respondedAt: timestamp("responded_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    actualAttendance: actualAttendanceEnum("actual_attendance")
      .default("UNKNOWN")
      .notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("adult_event_responses_event_user_key").on(table.eventId, table.userId)],
);

export const lineupPlans = pgTable(
  "lineup_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    inningsCount: integer("innings_count").default(6).notNull(),
    updatedByUserId: uuid("updated_by_user_id").references(() => adultUsers.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("lineup_plans_event_key").on(table.eventId)],
);

export const battingSlots = pgTable(
  "batting_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lineupPlanId: uuid("lineup_plan_id")
      .notNull()
      .references(() => lineupPlans.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    slotNumber: integer("slot_number").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("batting_slots_plan_slot_key").on(table.lineupPlanId, table.slotNumber),
    uniqueIndex("batting_slots_plan_player_key").on(table.lineupPlanId, table.playerId),
  ],
);

export const inningAssignments = pgTable(
  "inning_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lineupPlanId: uuid("lineup_plan_id")
      .notNull()
      .references(() => lineupPlans.id, { onDelete: "cascade" }),
    inningNumber: integer("inning_number").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    positionTemplateId: uuid("position_template_id").references(
      () => teamPositionTemplates.id,
      { onDelete: "set null" },
    ),
    positionCode: text("position_code").notNull(),
    positionLabel: text("position_label").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("inning_assignments_plan_inning_player_key").on(
      table.lineupPlanId,
      table.inningNumber,
      table.playerId,
    ),
  ],
);

export const lineupPresets = pgTable(
  "lineup_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    inningsCount: integer("innings_count").default(6).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => adultUsers.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("lineup_presets_team_name_key").on(table.teamId, table.name)],
);

export const lineupPresetSlots = pgTable(
  "lineup_preset_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    presetId: uuid("preset_id")
      .notNull()
      .references(() => lineupPresets.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    slotNumber: integer("slot_number").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("lineup_preset_slots_preset_slot_key").on(table.presetId, table.slotNumber),
    uniqueIndex("lineup_preset_slots_preset_player_key").on(table.presetId, table.playerId),
  ],
);

export const lineupPresetAssignments = pgTable(
  "lineup_preset_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    presetId: uuid("preset_id")
      .notNull()
      .references(() => lineupPresets.id, { onDelete: "cascade" }),
    inningNumber: integer("inning_number").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    positionTemplateId: uuid("position_template_id").references(
      () => teamPositionTemplates.id,
      { onDelete: "set null" },
    ),
    positionCode: text("position_code").notNull(),
    positionLabel: text("position_label").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("lineup_preset_assignments_preset_inning_player_key").on(
      table.presetId,
      table.inningNumber,
      table.playerId,
    ),
  ],
);

export const emailMessages = pgTable("email_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  createdByUserId: uuid("created_by_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  kind: emailKindEnum("kind").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
  createdAt,
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  updatedAt,
});

export const emailRecipients = pgTable(
  "email_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailMessageId: uuid("email_message_id")
      .notNull()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => adultUsers.id, { onDelete: "set null" }),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    deliveryStatus: deliveryStatusEnum("delivery_status")
      .default("PENDING")
      .notNull(),
    providerMessageId: text("provider_message_id"),
    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
      mode: "date",
    }),
    errorMessage: text("error_message"),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("email_recipients_message_email_key").on(table.emailMessageId, table.email)],
);

export const textMessages = pgTable("text_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  createdByUserId: uuid("created_by_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  kind: emailKindEnum("kind").notNull(),
  body: text("body").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
  createdAt,
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  updatedAt,
});

export const textRecipients = pgTable(
  "text_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    textMessageId: uuid("text_message_id")
      .notNull()
      .references(() => textMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => adultUsers.id, { onDelete: "set null" }),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    phone: text("phone").notNull(),
    deliveryStatus: deliveryStatusEnum("delivery_status")
      .default("PENDING")
      .notNull(),
    providerMessageId: text("provider_message_id"),
    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
      mode: "date",
    }),
    errorMessage: text("error_message"),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("text_recipients_message_phone_key").on(table.textMessageId, table.phone)],
);

export const reminderDeliveries = pgTable(
  "reminder_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => adultUsers.id, { onDelete: "cascade" }),
    emailRecipientId: uuid("email_recipient_id").references(() => emailRecipients.id, {
      onDelete: "set null",
    }),
    textRecipientId: uuid("text_recipient_id").references(() => textRecipients.id, {
      onDelete: "set null",
    }),
    reminderType: reminderTypeEnum("reminder_type").notNull(),
    createdAt,
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("reminder_deliveries_event_user_type_key").on(table.eventId, table.userId, table.reminderType)],
);

export type TeamRole = (typeof teamRoleEnum.enumValues)[number];
export type EventType = (typeof eventTypeEnum.enumValues)[number];
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];
export type AttendanceStatus = (typeof attendanceStatusEnum.enumValues)[number];
export type ActualAttendance = (typeof actualAttendanceEnum.enumValues)[number];
export type EmailKind = (typeof emailKindEnum.enumValues)[number];
