import webpush from 'web-push';
import { eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import {
  pushKeys,
  pushSubscriptions,
  pushDeliveries,
  users,
  households,
} from '@family/database';
import type { FamilyService } from './service';
export const subscriptionSchema = z.object({
  endpoint: z
    .url()
    .max(2048)
    .refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        (!u.port || u.port === '443') &&
        ([
          'fcm.googleapis.com',
          'updates.push.services.mozilla.com',
          'web.push.apple.com',
        ].includes(u.hostname) ||
          u.hostname.endsWith('.push.services.mozilla.com') ||
          u.hostname.endsWith('.notify.windows.com') ||
          u.hostname.endsWith('.push.apple.com'))
      );
    }, 'Unsupported browser push service'),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87,88}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22,24}$/),
  }),
});
export function pendingAlerts(service: FamilyService) {
  if (!service.store.db.select().from(households).get()) return [];
  const active = new Set(
    service.store.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.active, true))
      .all()
      .map((u) => u.id),
  );
  const now = service.now();
  return service
    .todayDoses()
    .filter(
      (d) =>
        active.has(d.userId) &&
        d.scheduledAt <= now &&
        ['DUE', 'SNOOZED', 'AWAITING_SUPERVISION'].includes(d.status) &&
        (!d.snoozedUntil || d.snoozedUntil <= now),
    )
    .map((d) => {
      const kind =
        d.status === 'AWAITING_SUPERVISION'
          ? 'confirmation'
          : Date.parse(now) >
              Date.parse(d.scheduledAt) + d.gracePeriodMinutes * 60000
            ? 'overdue'
            : 'due';
      return {
        id: `${d.id}:${kind}:${d.snoozedUntil ?? ''}`,
        userId: d.userId,
        kind,
      };
    });
}
type Transport = (
  subscription: webpush.PushSubscription,
  payload: string,
  options: webpush.RequestOptions,
) => Promise<unknown>;
export class PushService {
  private busy = false;
  constructor(
    private service: FamilyService,
    private send: Transport = webpush.sendNotification,
  ) {}
  keys() {
    const { db } = this.service.store;
    let keys = db.select().from(pushKeys).get();
    if (!keys) {
      const generated = webpush.generateVAPIDKeys();
      db.insert(pushKeys)
        .values({ id: 1, ...generated })
        .onConflictDoNothing()
        .run();
      keys = db.select().from(pushKeys).get()!;
    }
    return keys;
  }
  async deliver(subscription: webpush.PushSubscription, test = false) {
    const keys = this.keys();
    await this.send(
      subscription,
      JSON.stringify({
        title: test ? 'PebbleDose test' : 'PebbleDose reminder',
        body: test
          ? 'Notifications are working on this device.'
          : 'A household medicine reminder needs attention. Open PebbleDose to review it.',
        tag: test ? 'pebbledose-test' : 'pebbledose-reminder',
      }),
      {
        TTL: 120,
        timeout: 10000,
        urgency: 'normal',
        vapidDetails: {
          subject: process.env.PUSH_SUBJECT ?? 'https://pebbledose.local',
          publicKey: keys.publicKey,
          privateKey: keys.privateKey,
        },
      },
    );
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const { db } = this.service.store;
      const now = this.service.now();
      db.delete(pushDeliveries)
        .where(
          lt(
            pushDeliveries.createdAt,
            new Date(Date.parse(now) - 8 * 86400000).toISOString(),
          ),
        )
        .run();
      const alerts = pendingAlerts(this.service);
      for (const sub of db.select().from(pushSubscriptions).all()) {
        if (sub.retryAt && sub.retryAt > now) continue;
        const fresh = alerts.filter(
          (a) =>
            !db
              .select()
              .from(pushDeliveries)
              .where(eq(pushDeliveries.id, `${sub.deviceId}:${a.id}`))
              .get(),
        );
        if (!fresh.length) continue;
        try {
          await this.deliver(JSON.parse(sub.subscription));
          for (const alert of fresh)
            db.insert(pushDeliveries)
              .values({ id: `${sub.deviceId}:${alert.id}`, createdAt: now })
              .onConflictDoNothing()
              .run();
          db.update(pushSubscriptions)
            .set({ failures: 0, retryAt: null })
            .where(eq(pushSubscriptions.deviceId, sub.deviceId))
            .run();
        } catch (error) {
          const code = (error as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410)
            db.delete(pushSubscriptions)
              .where(eq(pushSubscriptions.deviceId, sub.deviceId))
              .run();
          else
            db.update(pushSubscriptions)
              .set({
                failures: sub.failures + 1,
                retryAt: new Date(
                  Date.parse(now) +
                    Math.min(3600000, 30000 * 2 ** Math.min(sub.failures, 7)),
                ).toISOString(),
              })
              .where(eq(pushSubscriptions.deviceId, sub.deviceId))
              .run();
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
