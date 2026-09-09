import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { devices, pushSubscriptions } from '@family/database';
import type { RouteContext } from './context';
import { DomainError } from '../errors';
import { PushService, pendingAlerts, subscriptionSchema } from '../domain/push';
export function pushRoutes(
  app: FastifyInstance,
  { db, service }: RouteContext,
) {
  const push = new PushService(service);
  const device = (r: FastifyRequest) => {
    const id = r.cookies.family_device;
    if (!id || !db.select().from(devices).where(eq(devices.id, id)).get())
      throw new DomainError(401, 'Open the kiosk on this device first');
    return id;
  };
  app.get('/api/alerts', () => pendingAlerts(service));
  app.get('/api/push/config', (r) => ({
    publicKey: push.keys().publicKey,
    subscribed: !!(
      r.cookies.family_device &&
      db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.deviceId, r.cookies.family_device))
        .get()
    ),
  }));
  app.post('/api/push/subscribe', (r) => {
    const deviceId = device(r);
    const subscription = JSON.stringify(subscriptionSchema.parse(r.body));
    db.insert(pushSubscriptions)
      .values({ deviceId, subscription })
      .onConflictDoUpdate({
        target: pushSubscriptions.deviceId,
        set: { subscription, failures: 0, retryAt: null },
      })
      .run();
    return { ok: true };
  });
  app.post('/api/push/unsubscribe', (r) => {
    db.delete(pushSubscriptions)
      .where(eq(pushSubscriptions.deviceId, device(r)))
      .run();
    return { ok: true };
  });
  app.post(
    '/api/push/test',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (r) => {
      const subscription = db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.deviceId, device(r)))
        .get();
      if (!subscription)
        throw new DomainError(400, 'Enable notifications first');
      try {
        await push.deliver(JSON.parse(subscription.subscription), true);
      } catch {
        throw new DomainError(
          502,
          'The push service could not be reached. Check the server’s Internet connection and retry.',
        );
      }
      return { ok: true };
    },
  );
}
