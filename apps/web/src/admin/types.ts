import type { z } from 'zod';
import type {
  medicationSchema,
  scheduleSchema,
  settingsSchema,
  Dose,
  Profile,
  Reward,
} from '@family/shared';
export interface FamilyUser {
  kioskPinRequired: boolean;
  feedbackStyle: 'AUTO' | 'PLAYFUL' | 'QUIET' | 'OFF';
  soundEnabled: boolean;
  id: string;
  name: string;
  displayName: string;
  avatar: string;
  role: 'ADULT' | 'CHILD';
  active: boolean;
  hasPin: boolean;
  rewardPoints: number;
}
export type Medication = z.infer<typeof medicationSchema> & { id: string };
export type Schedule = z.infer<typeof scheduleSchema> & { id: string };
export interface Audit {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  metadata: string;
}
export interface AdminData {
  asNeededHistory: import('@family/shared').AsNeededUse[];
  household: { name: string; timezone: string };
  profiles: Profile[];
  users: FamilyUser[];
  medications: Medication[];
  schedules: Schedule[];
  rewards: Reward[];
  rewardSettings: z.infer<typeof settingsSchema>;
  today: Dose[];
  history: Dose[];
  audit: Audit[];
  rewardEvents: {
    id: string;
    userId: string;
    points: number;
    reason: string;
    createdAt: string;
  }[];
}
export function formatTime(value: string, timezone: string, withDate = false) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...(withDate ? ({ month: 'short', day: 'numeric' } as const) : {}),
    timeZone: timezone,
  }).format(new Date(value));
}
