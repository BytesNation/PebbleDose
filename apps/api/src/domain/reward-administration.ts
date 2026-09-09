import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  households,
  rewardDefinitions,
  rewardSettings,
  users,
  type Store,
} from '@family/database';
import type { z } from 'zod';
import type { rewardSchema, settingsSchema } from '@family/shared';
import { DomainError, requireValue } from '../errors';
import type { RewardService } from './rewards';
import type { AuditService } from './audit';
export class RewardAdministration {
  constructor(
    private store: Store,
    private rewards: RewardService,
    private audit: AuditService,
    private now: () => string,
  ) {}
  save(input: z.infer<typeof rewardSchema>, actor: string, id?: string) {
    const { db } = this.store;
    const household = requireValue(db.select().from(households).get()),
      at = this.now(),
      rewardId = id ?? randomUUID();
    return this.store.sqlite.transaction(() => {
      if (id) {
        requireValue(
          db
            .select()
            .from(rewardDefinitions)
            .where(eq(rewardDefinitions.id, id))
            .get(),
        );
        db.update(rewardDefinitions)
          .set({ ...input, updatedAt: at })
          .where(eq(rewardDefinitions.id, id))
          .run();
      } else
        db.insert(rewardDefinitions)
          .values({
            ...input,
            id: rewardId,
            householdId: household.id,
            createdAt: at,
            updatedAt: at,
          })
          .run();
      this.audit.record(
        actor,
        id ? 'Reward changed' : 'Reward created',
        rewardId,
        at,
      );
      return { id: rewardId };
    })();
  }
  settings(input: z.infer<typeof settingsSchema>, actor: string) {
    const household = requireValue(
      this.store.db.select().from(households).get(),
    );
    this.store.sqlite.transaction(() => {
      this.store.db
        .update(rewardSettings)
        .set(input)
        .where(eq(rewardSettings.householdId, household.id))
        .run();
      this.audit.record(
        actor,
        'Reward values changed',
        household.id,
        this.now(),
        input,
      );
    })();
    return { ok: true };
  }
  redeem(
    input: { userId: string; rewardId: string; requestId: string },
    actor: string,
  ) {
    return this.store.sqlite.transaction(() => {
      if (this.rewards.hasSource(input.userId, 'REDEMPTION', input.requestId))
        return { ok: true, alreadyRecorded: true };
      const reward = requireValue(
        this.store.db
          .select()
          .from(rewardDefinitions)
          .where(eq(rewardDefinitions.id, input.rewardId))
          .get(),
      );
      const user = requireValue(
        this.store.db
          .select()
          .from(users)
          .where(eq(users.id, input.userId))
          .get(),
      );
      if (!reward.active) throw new DomainError(409, 'Reward is unavailable');
      if (!user.active) throw new DomainError(409, 'Profile is disabled');
      if (this.rewards.balance(user.id) < reward.pointCost)
        throw new DomainError(409, 'Not enough points yet');
      this.rewards.credit(
        user.id,
        -reward.pointCost,
        `Reward redeemed: ${reward.name}`,
        'REDEMPTION',
        input.requestId,
        this.now(),
      );
      this.audit.record(actor, 'Reward redeemed', reward.id, this.now(), {
        userId: user.id,
        points: reward.pointCost,
        requestId: input.requestId,
      });
      return { ok: true, alreadyRecorded: false };
    })();
  }
  adjust(
    input: {
      userId: string;
      points: number;
      reason: string;
      requestId: string;
    },
    actor: string,
  ) {
    requireValue(
      this.store.db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .get(),
    );
    return this.store.sqlite.transaction(() => {
      if (this.rewards.hasSource(input.userId, 'ADJUSTMENT', input.requestId))
        return { ok: true };
      if (this.rewards.balance(input.userId) + input.points < 0)
        throw new DomainError(409, 'Balance cannot be negative');
      this.rewards.credit(
        input.userId,
        input.points,
        input.reason,
        'ADJUSTMENT',
        input.requestId,
        this.now(),
      );
      this.audit.record(
        actor,
        'Reward manually adjusted',
        input.userId,
        this.now(),
        { points: input.points, reason: input.reason },
      );
      return { ok: true };
    })();
  }
}
