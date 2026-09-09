import { recordAsNeeded } from '../domain/as-needed';
import { asNeededUseSchema } from '@family/shared';
import { asNeededUses } from '@family/database';
import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context';
import { devices } from '@family/database';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { actionSchema } from '@family/shared';
export function kioskRoutes(app: FastifyInstance, context: RouteContext) {
  const { db, service, auth, actor, adult, id, profileAccess } = context;
  app.post('/api/kiosk/connect', (r, reply) => {
    auth.logout(r.cookies.family_session);
    reply.clearCookie('family_session', { path: '/' });
    const previous = r.cookies.family_device
      ? db
          .select()
          .from(devices)
          .where(eq(devices.id, r.cookies.family_device))
          .get()
      : null;
    const deviceId = previous?.id ?? randomUUID();
    if (previous)
      db.update(devices)
        .set({ lastSeenAt: service.now() })
        .where(eq(devices.id, deviceId))
        .run();
    else
      db.insert(devices)
        .values({
          id: deviceId,
          householdId: service.household().id,
          name: 'Household browser',
          deviceType: 'WEB',
          createdAt: service.now(),
          lastSeenAt: service.now(),
        })
        .run();
    reply.setCookie('family_device', deviceId, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 31536000,
    });
    return { ok: true };
  });
  app.get('/api/kiosk', () => {
    service.scheduler.generate();
    return service.kiosk();
  });
  app.get('/api/kiosk/profiles/:id', (r) => {
    const userId = id(r);
    profileAccess(r, userId);
    service.scheduler.generate();
    const profile = service.profileData(userId);
    const start = new Date();
    start.setTime(Date.parse(service.now()) - 7 * 86400000);
    const uses = db
      .select()
      .from(asNeededUses)
      .where(eq(asNeededUses.userId, userId))
      .all()
      .filter((u) => u.usedAt >= start.toISOString());
    return {
      ...profile,
      history: [
        ...profile.history,
        ...uses.map((u) => ({
          id: u.id,
          scheduledAt: u.usedAt,
          acknowledgedAt: u.usedAt,
          status: 'TAKEN' as const,
          displayName: u.displayName,
          doseDisplay: u.doseDisplay,
          asNeeded: true,
        })),
      ],
    };
  });
  app.post('/api/as-needed/:id/uses', (r) =>
    recordAsNeeded(service, id(r), asNeededUseSchema.parse(r.body), actor(r)),
  );
  app.post('/api/doses/:id/actions', (r) =>
    service.act(
      id(r),
      {
        ...actionSchema.parse(r.body),
        deviceId:
          actionSchema.parse(r.body).deviceId ?? r.cookies.family_device,
      },
      actor(r),
    ),
  );
  app.post('/api/devices', (r) => {
    const input = z
      .object({
        name: z.string().min(1).max(100),
        deviceType: z.enum(['WEB', 'KIOSK', 'RPI', 'ANDROID', 'IOS']),
      })
      .parse(r.body);
    adult(r);
    const record = {
      ...input,
      id: randomUUID(),
      householdId: service.household().id,
      lastSeenAt: service.now(),
      createdAt: service.now(),
    };
    db.insert(devices).values(record).run();
    return { id: record.id };
  });
  app.get('/api/notifications', () => {
    service.scheduler.generate();
    const now = service.now();
    const pending = service
      .todayDoses()
      .filter(
        (d) =>
          d.scheduledAt <= now &&
          ['DUE', 'SNOOZED', 'AWAITING_SUPERVISION'].includes(d.status),
      )
      .map((d) => ({
        type:
          d.status === 'AWAITING_SUPERVISION'
            ? 'ParentConfirmationRequired'
            : Date.parse(now) >
                Date.parse(d.scheduledAt) + d.gracePeriodMinutes * 60000
              ? 'MedicationOverdue'
              : 'MedicationDue',
        userId: d.userId,
        doseId: d.id,
        createdAt: now,
      }));
    return [...pending, ...service.notifications.alerts];
  });
}
