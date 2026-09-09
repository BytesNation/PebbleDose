import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context';
import { rewardDefinitions } from '@family/database';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rewardSchema, settingsSchema, idSchema } from '@family/shared';
import { RewardAdministration } from '../domain/reward-administration';
export function rewardsRoutes(app: FastifyInstance, context: RouteContext) {
  const { db, service, adult, id, profileAccess } = context;
  const management = new RewardAdministration(
    service.store,
    service.rewards,
    service.audit,
    service.now,
  );
  app.get('/api/kiosk/profiles/:id/rewards', (r) => {
    const userId = id(r);
    profileAccess(r, userId);
    return {
      soundEnabled: service.user(userId).soundEnabled,
      feedbackStyle: service.user(userId).feedbackStyle,
      points: service.rewards.balance(userId),
      rewards: db
        .select()
        .from(rewardDefinitions)
        .where(eq(rewardDefinitions.active, true))
        .all(),
    };
  });
  app.post('/api/admin/rewards', (r, reply) =>
    reply
      .code(201)
      .send(management.save(rewardSchema.parse(r.body), adult(r).id)),
  );
  app.put('/api/admin/rewards/:id', (r) =>
    management.save(rewardSchema.parse(r.body), adult(r).id, id(r)),
  );
  app.put('/api/admin/reward-settings', (r) =>
    management.settings(settingsSchema.parse(r.body), adult(r).id),
  );
  app.post('/api/admin/redeem', (r) =>
    management.redeem(
      z
        .object({ userId: idSchema, rewardId: idSchema, requestId: idSchema })
        .parse(r.body),
      adult(r).id,
    ),
  );
  app.post('/api/admin/points', (r) =>
    management.adjust(
      z
        .object({
          userId: idSchema,
          points: z.number().int().min(-10000).max(10000),
          reason: z.string().trim().min(1).max(200),
          requestId: idSchema,
        })
        .parse(r.body),
      adult(r).id,
    ),
  );
}
