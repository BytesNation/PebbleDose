import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { eq, and } from 'drizzle-orm';
import {
  households,
  users,
  medications,
  schedules,
  scheduleDays,
  doses,
  type Store,
} from '@family/database';
import { scheduledInstant, dayAt } from './time';
import type { AuditService } from './audit';
export class Scheduler {
  constructor(
    private store: Store,
    private now: () => string,
    private audit: AuditService,
  ) {}
  generate() {
    const { db, sqlite } = this.store;
    const household = db.select().from(households).get();
    if (!household) return;
    const now = this.now(),
      today = dayAt(now, household.timezone);
    const through = DateTime.fromISO(today).plus({ days: 1 }).toISODate()!;
    sqlite.transaction(() => {
      const rows = db
        .select({ schedule: schedules, medication: medications, user: users })
        .from(schedules)
        .innerJoin(medications, eq(schedules.medicationId, medications.id))
        .innerJoin(users, eq(medications.userId, users.id))
        .where(
          and(
            eq(schedules.active, true),
            eq(medications.active, true),
            eq(medications.usageType, 'SCHEDULED'),
            eq(users.active, true),
          ),
        )
        .all();
      for (const { schedule, medication } of rows) {
        const daysOfWeek = db
          .select()
          .from(scheduleDays)
          .where(eq(scheduleDays.scheduleId, schedule.id))
          .all()
          .map((d) => d.day);
        let day = schedule.generatedThrough
          ? DateTime.fromISO(schedule.generatedThrough)
              .plus({ days: 1 })
              .toISODate()!
          : [schedule.startDate, dayAt(schedule.createdAt, household.timezone)]
              .sort()
              .at(-1)!;
        let processed = 0,
          last = schedule.generatedThrough;
        // Bound each pass after long outages. Subsequent passes continue the backlog without dropping days.
        for (
          ;
          day <= through && processed < 366;
          day = DateTime.fromISO(day).plus({ days: 1 }).toISODate()!,
            processed++
        ) {
          const scheduledAt = scheduledInstant(
            { ...schedule, daysOfWeek },
            day,
            household.timezone,
          );
          if (scheduledAt)
            db.insert(doses)
              .values({
                id: randomUUID(),
                householdId: household.id,
                userId: medication.userId,
                medicationId: medication.id,
                scheduleId: schedule.id,
                scheduledAt,
                status: day < today ? 'MISSED' : 'DUE',
                displayName: medication.privacyMode
                  ? medication.displayName
                  : medication.name,
                doseDisplay: medication.doseDisplay,
                instructions: medication.instructions,
                requiresSupervision: medication.requiresSupervision,
                gracePeriodMinutes: schedule.gracePeriodMinutes,
                period: schedule.scheduleType,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoNothing()
              .run();
          last = day;
        }
        if (last)
          db.update(schedules)
            .set({ generatedThrough: last })
            .where(eq(schedules.id, schedule.id))
            .run();
      }
      for (const dose of db.select().from(doses).all()) {
        if (!['DUE', 'SNOOZED', 'AWAITING_SUPERVISION'].includes(dose.status))
          continue;
        const deadline = Math.max(
          DateTime.fromISO(dose.scheduledAt, { zone: household.timezone })
            .endOf('day')
            .toMillis(),
          Date.parse(dose.scheduledAt) + dose.gracePeriodMinutes * 60000,
        );
        if (Date.parse(now) > deadline) {
          db.update(doses)
            .set({ status: 'MISSED', updatedAt: now })
            .where(eq(doses.id, dose.id))
            .run();
          this.audit.record('scheduler', 'Dose missed', dose.id, now, {
            previousStatus: dose.status,
          });
        } else if (
          dose.status === 'SNOOZED' &&
          dose.snoozedUntil &&
          dose.snoozedUntil <= now
        )
          db.update(doses)
            .set({ status: 'DUE', snoozedUntil: null, updatedAt: now })
            .where(eq(doses.id, dose.id))
            .run();
      }
    })();
  }
}
