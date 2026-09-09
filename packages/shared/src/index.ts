import { avatarSchema } from './avatars';
export * from './avatars';
import { z } from 'zod';
export const healthSchema = z.object({ status: z.literal('ok') });
export const idSchema = z.string().uuid();
const label = z.string().trim().min(1).max(100);
const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const pinSchema = z.string().regex(/^\d{4,12}$/, 'Use 4 to 12 digits');
export const userSchema = z
  .object({
    name: label,
    displayName: label,
    feedbackStyle: z.enum(['AUTO', 'PLAYFUL', 'QUIET', 'OFF']).optional(),
    soundEnabled: z.boolean().optional(),
    kioskPinRequired: z.boolean().optional(),
    avatar: avatarSchema.default('sun'),
    role: z.enum(['ADULT', 'CHILD']),
    pin: pinSchema.optional(),
    active: z.boolean().default(true),
  })
  .refine((v) => v.role !== 'ADULT' || !!v.pin, {
    message: 'Adults need a PIN',
    path: ['pin'],
  });
export const userUpdateSchema = z.object({
  kioskPinRequired: z.boolean().optional(),
  feedbackStyle: z.enum(['AUTO', 'PLAYFUL', 'QUIET', 'OFF']).optional(),
  soundEnabled: z.boolean().optional(),
  name: label,
  displayName: label,
  avatar: avatarSchema,
  role: z.enum(['ADULT', 'CHILD']),
  pin: pinSchema.optional(),
  active: z.boolean(),
});
export const setupSchema = z.object({
  name: label,
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Choose a valid timezone'),
  adult: userSchema.refine(
    (v) => v.role === 'ADULT',
    'First account must be an adult',
  ),
});
export const medicationSchema = z.object({
  usageType: z.enum(['SCHEDULED', 'AS_NEEDED']).default('SCHEDULED'),
  userId: idSchema,
  name: label,
  displayName: label,
  instructions: z.string().trim().max(500).default(''),
  doseDisplay: z.string().trim().min(1).max(100),
  image: z
    .string()
    .regex(/^\/api\/images\/[a-f0-9-]+\.(png|jpg|webp)$/)
    .nullable()
    .default(null),
  active: z.boolean().default(true),
  privacyMode: z.boolean().default(true),
  requiresSupervision: z.boolean().default(false),
});
export const scheduleSchema = z
  .object({
    medicationId: idSchema,
    scheduleType: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'EXACT_TIME']),
    timeOfDay: time,
    exactTime: time.nullable().default(null),
    daysOfWeek: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .refine((v) => new Set(v).size === v.length),
    startDate: date,
    endDate: date.nullable().default(null),
    gracePeriodMinutes: z.number().int().min(0).max(1440).default(60),
    active: z.boolean().default(true),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: 'End date must follow start date',
    path: ['endDate'],
  })
  .refine((v) => v.scheduleType !== 'EXACT_TIME' || v.exactTime !== null, {
    message: 'Exact time is required',
    path: ['exactTime'],
  });
export const loginSchema = z.object({ userId: idSchema, pin: pinSchema });
export const actionSchema = z.object({
  action: z.enum(['TAKE', 'READY', 'CONFIRM', 'SKIP', 'SNOOZE']),
  notes: z.string().trim().max(500).optional(),
  minutes: z.number().int().min(1).max(120).default(10),
  deviceId: idSchema.optional(),
});
export const rewardSchema = z.object({
  name: label,
  description: z.string().trim().max(500).default(''),
  pointCost: z.number().int().min(1).max(100000),
  active: z.boolean().default(true),
});
export const settingsSchema = z.object({
  medication: z.number().int().min(0).max(1000),
  daily: z.number().int().min(0).max(1000),
  sevenDay: z.number().int().min(0).max(1000),
  thirtyDay: z.number().int().min(0).max(1000),
});
export type DoseStatus =
  'DUE' | 'TAKEN' | 'SKIPPED' | 'MISSED' | 'SNOOZED' | 'AWAITING_SUPERVISION';
export type Action = z.infer<typeof actionSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type FeedbackStyle = 'AUTO' | 'PLAYFUL' | 'QUIET' | 'OFF';
export interface CompletionFeedback {
  dayComplete: boolean;
  periodComplete: string | null;
  medicationPoints: number;
  dailyPoints: number;
  streakPoints: number;
  balance: number;
  nextReward: { name: string; pointCost: number } | null;
}
export interface DoseActionResult {
  status: DoseStatus;
  points: number;
  alreadyRecorded: boolean;
  feedback?: CompletionFeedback;
}
export interface Profile {
  kioskPinRequired: boolean;
  feedbackStyle: FeedbackStyle;
  soundEnabled: boolean;
  id: string;
  displayName: string;
  avatar: string;
  role: 'ADULT' | 'CHILD';
  rewardPoints: number;
  hasPin: boolean;
  complete: number;
  total: number;
  due: number;
  overdue: number;
  awaiting: number;
  nextAt: string | null;
}
export interface Dose {
  id: string;
  userId: string;
  medicationId: string;
  scheduledAt: string;
  acknowledgedAt: string | null;
  status: DoseStatus;
  displayName: string;
  doseDisplay: string;
  instructions: string;
  requiresSupervision: boolean;
  period: string;
  gracePeriodMinutes: number;
  snoozedUntil: string | null;
  image?: string | null;
}
export interface KioskData {
  household: { name: string; timezone: string };
  profiles: Profile[];
  returnDelay: number;
  now: string;
}
export type KioskHistoryDose = { asNeeded?: boolean } & Pick<
  Dose,
  | 'id'
  | 'scheduledAt'
  | 'acknowledgedAt'
  | 'status'
  | 'displayName'
  | 'doseDisplay'
>;
export interface AsNeededMedication {
  id: string;
  displayName: string;
  doseDisplay: string;
  instructions: string;
  requiresSupervision: boolean;
  lastUsedAt: string | null;
}
export interface AsNeededUse {
  id: string;
  userId: string;
  medicationId: string;
  displayName: string;
  doseDisplay: string;
  usedAt: string;
  confirmationType: 'SELF' | 'PARENT';
}
export const asNeededUseSchema = z.object({
  requestId: idSchema,
  doseDisplay: label,
});
export interface ProfileData {
  asNeeded: AsNeededMedication[];
  history: KioskHistoryDose[];
  returnDelay: number;
  awardPoints: number;
  profile: Profile;
  doses: Dose[];
  streak: number;
  timezone: string;
}
export interface Reward {
  id: string;
  name: string;
  description: string;
  pointCost: number;
  active: boolean;
}
