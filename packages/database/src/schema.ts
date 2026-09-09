import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
const timestamps = () => ({
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  ...timestamps(),
});
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  avatar: text('avatar').notNull(),
  role: text('role', { enum: ['ADULT', 'CHILD'] }).notNull(),
  feedbackStyle: text('feedback_style', {
    enum: ['AUTO', 'PLAYFUL', 'QUIET', 'OFF'],
  })
    .notNull()
    .default('AUTO'),
  soundEnabled: integer('sound_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  kioskPinRequired: integer('kiosk_pin_required', { mode: 'boolean' })
    .notNull()
    .default(false),
  pinHash: text('pin_hash'),
  rewardPoints: integer('reward_points').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps(),
});
export const medications = sqliteTable('medications', {
  usageType: text('usage_type', { enum: ['SCHEDULED', 'AS_NEEDED'] })
    .notNull()
    .default('SCHEDULED'),
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  instructions: text('instructions').notNull(),
  doseDisplay: text('dose_display').notNull(),
  image: text('image'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  privacyMode: integer('privacy_mode', { mode: 'boolean' })
    .notNull()
    .default(true),
  requiresSupervision: integer('requires_supervision', { mode: 'boolean' })
    .notNull()
    .default(false),
  ...timestamps(),
});
export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  medicationId: text('medication_id')
    .notNull()
    .references(() => medications.id),
  scheduleType: text('schedule_type', {
    enum: ['MORNING', 'AFTERNOON', 'EVENING', 'EXACT_TIME'],
  }).notNull(),
  timeOfDay: text('time_of_day').notNull(),
  exactTime: text('exact_time'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  gracePeriodMinutes: integer('grace_period_minutes').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  generatedThrough: text('generated_through'),
  ...timestamps(),
});
export const scheduleDays = sqliteTable(
  'schedule_days',
  {
    scheduleId: text('schedule_id')
      .notNull()
      .references(() => schedules.id),
    day: integer('day').notNull(),
  },
  (t) => [primaryKey({ columns: [t.scheduleId, t.day] })],
);
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  name: text('name').notNull(),
  deviceType: text('device_type', {
    enum: ['WEB', 'KIOSK', 'RPI', 'ANDROID', 'IOS'],
  }).notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  createdAt: text('created_at').notNull(),
});
export const doses = sqliteTable(
  'dose_events',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    medicationId: text('medication_id')
      .notNull()
      .references(() => medications.id),
    scheduleId: text('schedule_id')
      .notNull()
      .references(() => schedules.id),
    scheduledAt: text('scheduled_at').notNull(),
    acknowledgedAt: text('acknowledged_at'),
    status: text('status', {
      enum: [
        'DUE',
        'TAKEN',
        'SKIPPED',
        'MISSED',
        'SNOOZED',
        'AWAITING_SUPERVISION',
      ],
    }).notNull(),
    confirmationType: text('confirmation_type', {
      enum: ['SELF', 'PARENT', 'ADMIN'],
    }),
    confirmedByUserId: text('confirmed_by_user_id').references(() => users.id),
    deviceId: text('device_id').references(() => devices.id),
    notes: text('notes'),
    snoozedUntil: text('snoozed_until'),
    displayName: text('display_name').notNull(),
    doseDisplay: text('dose_display').notNull(),
    instructions: text('instructions').notNull(),
    requiresSupervision: integer('requires_supervision', {
      mode: 'boolean',
    }).notNull(),
    gracePeriodMinutes: integer('grace_period_minutes').notNull(),
    period: text('period').notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex('dose_schedule_time').on(t.scheduleId, t.scheduledAt)],
);
export const rewardEvents = sqliteTable(
  'reward_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    points: integer('points').notNull(),
    reason: text('reason').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('reward_source').on(t.userId, t.sourceType, t.sourceId)],
);
export const rewardDefinitions = sqliteTable('reward_definitions', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  pointCost: integer('point_cost').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps(),
});
export const rewardSettings = sqliteTable('reward_settings', {
  householdId: text('household_id')
    .primaryKey()
    .references(() => households.id),
  medication: integer('medication').notNull().default(2),
  daily: integer('daily').notNull().default(3),
  sevenDay: integer('seven_day').notNull().default(10),
  thirtyDay: integer('thirty_day').notNull().default(25),
});
export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  target: text('target').notNull(),
  timestamp: text('timestamp').notNull(),
  metadata: text('metadata').notNull(),
});
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: text('expires_at').notNull(),
});
export const authAttempts = sqliteTable('auth_attempts', {
  userId: text('user_id').primaryKey(),
  count: integer('count').notNull(),
  blockedUntil: text('blocked_until').notNull(),
});

export const asNeededUses = sqliteTable('as_needed_uses', {
  id: text('id').primaryKey(),
  medicationId: text('medication_id')
    .notNull()
    .references(() => medications.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  usedAt: text('used_at').notNull(),
  displayName: text('display_name').notNull(),
  doseDisplay: text('dose_display').notNull(),
  confirmedByUserId: text('confirmed_by_user_id').references(() => users.id),
  confirmationType: text('confirmation_type', {
    enum: ['SELF', 'PARENT'],
  }).notNull(),
});
export const pushKeys = sqliteTable('push_keys', {
  id: integer('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
});
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  deviceId: text('device_id')
    .primaryKey()
    .references(() => devices.id),
  subscription: text('subscription').notNull(),
  retryAt: text('retry_at'),
  failures: integer('failures').notNull().default(0),
});
export const pushDeliveries = sqliteTable('push_deliveries', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
});
