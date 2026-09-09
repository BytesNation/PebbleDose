import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import {
  users,
  doses,
  rewardEvents,
  rewardSettings,
  households,
  type Store,
} from '@family/database';
import { dayAt, streaks } from './time';
import { requireValue } from '../errors';
export class RewardService {
  constructor(private store: Store) {}
  credit(
    userId: string,
    points: number,
    reason: string,
    sourceType: string,
    sourceId: string,
    at: string,
  ) {
    const inserted = this.store.db
      .insert(rewardEvents)
      .values({
        id: randomUUID(),
        userId,
        points,
        reason,
        sourceType,
        sourceId,
        createdAt: at,
      })
      .onConflictDoNothing()
      .run();
    if (inserted.changes)
      this.store.db
        .update(users)
        .set({
          rewardPoints: sql`${users.rewardPoints} + ${points}`,
          updatedAt: at,
        })
        .where(eq(users.id, userId))
        .run();
    return !!inserted.changes;
  }
  doseTaken(doseId: string, at: string) {
    const { db } = this.store;
    const dose = requireValue(
      db.select().from(doses).where(eq(doses.id, doseId)).get(),
    );
    const household = requireValue(db.select().from(households).get());
    const settings = requireValue(db.select().from(rewardSettings).get());
    this.credit(
      dose.userId,
      settings.medication,
      'Medication acknowledged',
      'DOSE',
      dose.id,
      at,
    );
    const records = db
      .select()
      .from(doses)
      .where(eq(doses.userId, dose.userId))
      .all();
    const day = dayAt(dose.scheduledAt, household.timezone);
    const daily = records.filter(
      (d) => dayAt(d.scheduledAt, household.timezone) === day,
    );
    if (daily.length && daily.every((d) => d.status === 'TAKEN')) {
      this.credit(
        dose.userId,
        settings.daily,
        'Daily medication goal completed',
        'DAILY',
        day,
        at,
      );
      const completedStreak = streaks(
        records.filter((d) => dayAt(d.scheduledAt, household.timezone) <= day),
        household.timezone,
        dose.scheduledAt,
      ).current;
      if (completedStreak > 0 && completedStreak % 7 === 0)
        this.credit(
          dose.userId,
          settings.sevenDay,
          'Seven day streak',
          'STREAK_7',
          day,
          at,
        );
      if (completedStreak > 0 && completedStreak % 30 === 0)
        this.credit(
          dose.userId,
          settings.thirtyDay,
          'Thirty day streak',
          'STREAK_30',
          day,
          at,
        );
    }
  }
  balance(userId: string) {
    return this.store.db
      .select({ points: sql<number>`coalesce(sum(${rewardEvents.points}),0)` })
      .from(rewardEvents)
      .where(eq(rewardEvents.userId, userId))
      .get()!.points;
  }
  hasSource(userId: string, type: string, id: string) {
    return this.store.db
      .select()
      .from(rewardEvents)
      .where(
        and(
          eq(rewardEvents.userId, userId),
          eq(rewardEvents.sourceType, type),
          eq(rewardEvents.sourceId, id),
        ),
      )
      .get();
  }
}
