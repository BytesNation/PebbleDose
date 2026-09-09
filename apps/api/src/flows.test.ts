import { beforeEach, afterEach, it, expect } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let uploadFolder: string;
import { createApp } from './app';
import { openDatabase, users, rewardEvents, doses } from '@family/database';
let store: ReturnType<typeof openDatabase>,
  app: ReturnType<typeof createApp>,
  cookie: string,
  adultId: string;
let now = '2026-09-09T14:00:00.000Z';
const headers = { 'x-family-client': '1' };
const post = (url: string, payload: unknown, adult = true) =>
  app.inject({
    method: 'POST',
    url,
    headers: { ...headers, ...(adult ? { cookie } : {}) },
    payload: payload as Record<string, unknown>,
  });
beforeEach(async () => {
  store = openDatabase(':memory:');
  migrate(store.db, { migrationsFolder: 'packages/database/migrations' });
  now = '2026-09-09T14:00:00.000Z';
  uploadFolder = mkdtempSync(join(tmpdir(), 'family-upload-test-'));
  app = createApp(store, { now: () => now, uploadFolder });
  const setup = await post(
    '/api/setup',
    {
      name: 'Demo household',
      timezone: 'UTC',
      adult: {
        name: 'Parent',
        displayName: 'Parent',
        role: 'ADULT',
        pin: '246810',
      },
    },
    false,
  );
  expect(setup.statusCode).toBe(201);
  adultId = setup.json().adultId;
  const login = await post(
    '/api/auth/login',
    { userId: adultId, pin: '246810' },
    false,
  );
  expect(login.statusCode).toBe(200);
  cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
});
afterEach(async () => {
  await app.close();
  store.sqlite.close();
  rmSync(uploadFolder, { recursive: true, force: true });
});
async function prescription(supervised = false) {
  const child = await post('/api/admin/users', {
    name: 'Kid',
    displayName: 'Kid',
    role: 'CHILD',
  });
  expect(child.statusCode).toBe(201);
  const userId = child.json().id;
  const medication = await post('/api/admin/medications', {
    userId,
    name: 'Private fake medicine',
    displayName: 'Morning Medicine',
    doseDisplay: '1 demo tablet',
    requiresSupervision: supervised,
  });
  expect(medication.statusCode).toBe(201);
  const medicationId = medication.json().id;
  const schedule = await post('/api/admin/schedules', {
    medicationId,
    scheduleType: 'MORNING',
    timeOfDay: '08:00',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    startDate: '2026-09-09',
  });
  expect(schedule.statusCode).toBe(201);
  const profile = await app.inject(`/api/kiosk/profiles/${userId}`);
  return {
    userId,
    medicationId,
    scheduleId: schedule.json().id,
    doseId: profile.json().doses[0].id,
  };
}
it('creates the first household through the API and closes setup afterward', async () => {
  expect((await app.inject('/api/setup')).json().required).toBe(false);
  expect(
    (
      await post(
        '/api/setup',
        {
          name: 'Other',
          timezone: 'UTC',
          adult: {
            name: 'Other',
            displayName: 'Other',
            role: 'ADULT',
            pin: '123456',
          },
        },
        false,
      )
    ).statusCode,
  ).toBe(409);
  expect(store.db.select().from(users).get()!.pinHash).not.toContain('246810');
});
it('protects admin endpoints, checks CSRF, and rejects bad PINs', async () => {
  expect((await app.inject('/api/admin')).statusCode).toBe(401);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { userId: adultId, pin: '246810' },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { ...headers, origin: 'https://evil.example' },
        payload: { userId: adultId, pin: '246810' },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (await post('/api/auth/login', { userId: adultId, pin: '000000' }, false))
      .statusCode,
  ).toBe(401);
});
it('generates one dose per occurrence and rewards a repeated acknowledgement once', async () => {
  const { doseId, userId } = await prescription();
  const first = await post(
    `/api/doses/${doseId}/actions`,
    { action: 'TAKE' },
    false,
  );
  expect(first.statusCode).toBe(200);
  expect(first.json().points).toBe(5);
  expect(
    (
      await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false)
    ).json().alreadyRecorded,
  ).toBe(true);
  expect(store.db.select().from(rewardEvents).all()).toHaveLength(2);
  expect(
    store.db.select().from(users).where(eq(users.id, userId)).get()!
      .rewardPoints,
  ).toBe(5);
  await app.inject('/api/kiosk');
  await app.inject('/api/kiosk');
  expect(store.db.select().from(doses).all()).toHaveLength(2);
  expect(
    (await app.inject(`/api/kiosk/profiles/${userId}`)).body,
  ).not.toContain('Private fake medicine');
});
it('requires parent confirmation and awards no points for readiness', async () => {
  const { doseId } = await prescription(true);
  expect(
    (await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false))
      .statusCode,
  ).toBe(403);
  expect(
    (
      await post(`/api/doses/${doseId}/actions`, { action: 'READY' }, false)
    ).json().status,
  ).toBe('AWAITING_SUPERVISION');
  expect(store.db.select().from(rewardEvents).all()).toHaveLength(0);
  expect(
    (await post(`/api/doses/${doseId}/actions`, { action: 'CONFIRM' }, false))
      .statusCode,
  ).toBe(403);
  expect(
    (await post(`/api/doses/${doseId}/actions`, { action: 'CONFIRM' })).json()
      .status,
  ).toBe('TAKEN');
  expect(
    store.db.select().from(doses).where(eq(doses.id, doseId)).get()!
      .confirmationType,
  ).toBe('PARENT');
});
it('snoozes then becomes due and audits an adult skip', async () => {
  const { doseId } = await prescription();
  expect(
    (
      await post(
        `/api/doses/${doseId}/actions`,
        { action: 'SNOOZE', minutes: 10 },
        false,
      )
    ).json().status,
  ).toBe('SNOOZED');
  now = '2026-09-09T14:11:00.000Z';
  await app.inject('/api/kiosk');
  expect(
    store.db.select().from(doses).where(eq(doses.id, doseId)).get()!.status,
  ).toBe('DUE');
  expect(
    (await post(`/api/doses/${doseId}/actions`, { action: 'SKIP' }, false))
      .statusCode,
  ).toBe(403);
  expect(
    (await post(`/api/doses/${doseId}/actions`, { action: 'SKIP' })).json()
      .status,
  ).toBe('SKIPPED');
  const admin = await app.inject({ url: '/api/admin', headers: { cookie } });
  expect(
    admin
      .json()
      .audit.some((a: { action: string }) => a.action === 'Dose skip'),
  ).toBe(true);
});
it('rejects early acknowledgement and cannot disable the final adult', async () => {
  const { userId } = await prescription();
  const future = store.db
    .select()
    .from(doses)
    .where(eq(doses.userId, userId))
    .all()
    .find((d) => d.scheduledAt > now)!;
  expect(
    (await post(`/api/doses/${future.id}/actions`, { action: 'TAKE' }, false))
      .statusCode,
  ).toBe(409);
  expect(
    (
      await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${adultId}`,
        headers: { ...headers, cookie },
        payload: {
          name: 'Parent',
          displayName: 'Parent',
          avatar: 'sun',
          role: 'ADULT',
          active: false,
        },
      })
    ).statusCode,
  ).toBe(409);
});
it('expires sessions and persists PIN lockout', async () => {
  for (let i = 0; i < 5; i++)
    expect(
      (await post('/api/auth/login', { userId: adultId, pin: '000000' }, false))
        .statusCode,
    ).toBe(401);
  expect(
    (await post('/api/auth/login', { userId: adultId, pin: '246810' }, false))
      .statusCode,
  ).toBe(429);
  now = '2026-09-09T14:16:00.000Z';
  expect(
    (await app.inject({ url: '/api/admin', headers: { cookie } })).statusCode,
  ).toBe(401);
});

it('validates image uploads and refuses active content', async () => {
  const boundary = 'family-test-boundary';
  const payload = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.svg"\r\nContent-Type: image/svg+xml\r\n\r\n<svg onload="alert(1)"></svg>\r\n--${boundary}--\r\n`,
  );
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/admin/images',
        headers: {
          ...headers,
          cookie,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/admin/images',
        headers: {
          ...headers,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      })
    ).statusCode,
  ).toBe(401);
});
it('preserves today’s dose snapshot when a medication is edited', async () => {
  const { medicationId, userId, doseId } = await prescription();
  const response = await app.inject({
    method: 'PUT',
    url: `/api/admin/medications/${medicationId}`,
    headers: { ...headers, cookie },
    payload: {
      userId,
      name: 'New demo name',
      displayName: 'New display name',
      doseDisplay: 'New adult dose text',
    },
  });
  expect(response.statusCode).toBe(200);
  expect(
    store.db.select().from(doses).where(eq(doses.id, doseId)).get()!
      .doseDisplay,
  ).toBe('1 demo tablet');
  await app.inject('/api/kiosk');
  expect(
    store.db
      .select()
      .from(doses)
      .where(eq(doses.userId, userId))
      .all()
      .find((d) => d.scheduledAt > now)!.doseDisplay,
  ).toBe('New adult dose text');
});

it('uses configurable rewards and prevents double spending on retries', async () => {
  const { doseId, userId } = await prescription();
  expect(
    (
      await app.inject({
        method: 'PUT',
        url: '/api/admin/reward-settings',
        headers: { ...headers, cookie },
        payload: { medication: 4, daily: 6, sevenDay: 12, thirtyDay: 30 },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false)
    ).json().points,
  ).toBe(10);
  const reward = await post('/api/admin/rewards', {
    name: 'Movie choice',
    pointCost: 7,
  });
  const rewardId = reward.json().id,
    requestId = crypto.randomUUID();
  expect(
    (await post('/api/admin/redeem', { userId, rewardId, requestId }, false))
      .statusCode,
  ).toBe(401);
  expect(
    (await post('/api/admin/redeem', { userId, rewardId, requestId }))
      .statusCode,
  ).toBe(200);
  expect(
    (await post('/api/admin/redeem', { userId, rewardId, requestId })).json()
      .alreadyRecorded,
  ).toBe(true);
  expect(
    store.db.select().from(users).where(eq(users.id, userId)).get()!
      .rewardPoints,
  ).toBe(3);
  expect(
    (
      await post('/api/admin/redeem', {
        userId,
        rewardId,
        requestId: crypto.randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
});
it.each([7, 30])(
  'awards the %i day milestone once from complete daily records',
  async (length) => {
    const { doseId, userId } = await prescription();
    const current = store.db
      .select()
      .from(doses)
      .where(eq(doses.id, doseId))
      .get()!;
    for (let i = 1; i < length; i++) {
      const scheduledAt = new Date(
        Date.parse(current.scheduledAt) - i * 86400000,
      ).toISOString();
      store.db
        .insert(doses)
        .values({
          ...current,
          id: crypto.randomUUID(),
          scheduledAt,
          acknowledgedAt: scheduledAt,
          status: 'TAKEN',
        })
        .run();
    }
    const result = await post(
      `/api/doses/${doseId}/actions`,
      { action: 'TAKE' },
      false,
    );
    expect(result.json().points).toBe(length === 7 ? 15 : 30);
    expect(
      (await app.inject(`/api/kiosk/profiles/${userId}`)).json().streak,
    ).toBe(length);
    await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false);
    expect(store.db.select().from(rewardEvents).all()).toHaveLength(3);
  },
);

it('protects PIN profiles and rejects a child session at admin routes', async () => {
  const child = await post('/api/admin/users', {
    kioskPinRequired: true,
    name: 'Protected child',
    displayName: 'Protected child',
    role: 'CHILD',
    pin: '123456',
  });
  const userId = child.json().id;
  expect((await app.inject(`/api/kiosk/profiles/${userId}`)).statusCode).toBe(
    401,
  );
  const login = await post('/api/auth/login', { userId, pin: '123456' }, false);
  const childCookie = login.cookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  expect(
    (
      await app.inject({
        url: `/api/kiosk/profiles/${userId}`,
        headers: { cookie: childCookie },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await app.inject({ url: '/api/admin', headers: { cookie: childCookie } }))
      .statusCode,
  ).toBe(403);
});
it('rolls back a dose acknowledgement if its reward transaction fails', async () => {
  const { doseId, userId } = await prescription();
  store.sqlite.exec(
    "CREATE TRIGGER fail_reward BEFORE INSERT ON reward_events BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
  );
  expect(
    (await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false))
      .statusCode,
  ).toBe(500);
  expect(
    store.db.select().from(doses).where(eq(doses.id, doseId)).get()!.status,
  ).toBe('DUE');
  expect(
    store.db.select().from(users).where(eq(users.id, userId)).get()!
      .rewardPoints,
  ).toBe(0);
});
it('catches up after an outage and retains missed occurrences', async () => {
  const { userId } = await prescription();
  now = '2026-09-12T14:00:00.000Z';
  await app.inject('/api/kiosk');
  const records = store.db
    .select()
    .from(doses)
    .where(eq(doses.userId, userId))
    .all();
  expect(records).toHaveLength(5);
  expect(records.filter((d) => d.status === 'MISSED')).toHaveLength(3);
});
it('requires an adult to resolve pending doses before disabling their medication', async () => {
  const { userId, medicationId } = await prescription();
  const response = await app.inject({
    method: 'PUT',
    url: `/api/admin/medications/${medicationId}`,
    headers: { ...headers, cookie },
    payload: {
      userId,
      name: 'Demo',
      displayName: 'Demo',
      doseDisplay: '1 demo tablet',
      active: false,
    },
  });
  expect(response.statusCode).toBe(409);
});

it('decodes a valid image and serves only its normalized content', async () => {
  const raw = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#f1e8d0' },
  })
    .png()
    .toBuffer();
  const boundary = 'family-image-boundary';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="demo.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    raw,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const uploaded = await app.inject({
    method: 'POST',
    url: '/api/admin/images',
    headers: {
      ...headers,
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
  expect(uploaded.statusCode).toBe(201);
  const image = await app.inject({
    url: uploaded.json().url,
    headers: { cookie },
  });
  expect(image.headers['content-type']).toContain('image/webp');
  const metadata = await sharp(image.rawPayload).metadata();
  expect(metadata.format).toBe('webp');
  expect(metadata.exif).toBeUndefined();
  expect((await app.inject(uploaded.json().url)).statusCode).toBe(404);
});

it('publishes completion notifications only after the dose is committed', async () => {
  const { doseId } = await prescription();
  await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false);
  const notifications = (await app.inject('/api/notifications')).json() as {
    type: string;
  }[];
  expect(notifications.some((n) => n.type === 'MedicationCompleted')).toBe(
    true,
  );
  expect(notifications.some((n) => n.type === 'DailyMedicationComplete')).toBe(
    true,
  );
});

it('returns confirmed award details and never celebrates duplicate acknowledgements', async () => {
  const { doseId } = await prescription();
  const result = (
    await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false)
  ).json();
  expect(result.feedback).toMatchObject({
    dayComplete: true,
    periodComplete: 'MORNING',
    medicationPoints: 2,
    dailyPoints: 3,
    streakPoints: 0,
    balance: 5,
  });
  const retry = (
    await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false)
  ).json();
  expect(retry.feedback).toBeUndefined();
  expect(retry.points).toBe(0);
});
it('celebrates the morning without claiming the day is done while evening medicine remains', async () => {
  const { doseId, userId, medicationId } = await prescription();
  await post('/api/admin/schedules', {
    medicationId,
    scheduleType: 'EVENING',
    timeOfDay: '20:00',
    startDate: '2026-09-09',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  });
  await app.inject(`/api/kiosk/profiles/${userId}`);
  const result = (
    await post(`/api/doses/${doseId}/actions`, { action: 'TAKE' }, false)
  ).json();
  expect(result.feedback).toMatchObject({
    dayComplete: false,
    periodComplete: 'MORNING',
    dailyPoints: 0,
    medicationPoints: 2,
  });
  const evening = (await app.inject(`/api/kiosk/profiles/${userId}`))
    .json()
    .doses.find((d: { period: string }) => d.period === 'EVENING');
  expect(
    (await post(`/api/doses/${evening.id}/actions`, { action: 'TAKE' }, false))
      .statusCode,
  ).toBe(409);
});
it('withholds celebration on readiness and returns it only after adult confirmation', async () => {
  const { doseId } = await prescription(true);
  const ready = (
    await post(`/api/doses/${doseId}/actions`, { action: 'READY' }, false)
  ).json();
  expect(ready.feedback).toBeUndefined();
  expect(ready.points).toBe(0);
  const confirmed = (
    await post(`/api/doses/${doseId}/actions`, { action: 'CONFIRM' })
  ).json();
  expect(confirmed.feedback.dayComplete).toBe(true);
});
it('saves feedback preferences per person and preserves them on older-client updates', async () => {
  const { userId } = await prescription();
  const body = {
    name: 'Kid',
    displayName: 'Kid',
    role: 'CHILD',
    avatar: 'star',
    active: true,
  };
  const update = await app.inject({
    method: 'PUT',
    url: `/api/admin/users/${userId}`,
    headers: { ...headers, cookie },
    payload: { ...body, feedbackStyle: 'QUIET', soundEnabled: true },
  });
  expect(update.statusCode).toBe(200);
  await app.inject({
    method: 'PUT',
    url: `/api/admin/users/${userId}`,
    headers: { ...headers, cookie },
    payload: body,
  });
  const profile = (await app.inject(`/api/kiosk/profiles/${userId}`)).json()
    .profile;
  expect(profile.feedbackStyle).toBe('QUIET');
  expect(profile.soundEnabled).toBe(true);
});

it('opens an adult kiosk profile without a PIN while keeping admin protected', async () => {
  expect((await app.inject(`/api/kiosk/profiles/${adultId}`)).statusCode).toBe(
    200,
  );
  expect(
    (await app.inject(`/api/kiosk/profiles/${adultId}/rewards`)).statusCode,
  ).toBe(200);
  expect((await app.inject('/api/admin')).statusCode).toBe(401);
});
it('requires an existing or new PIN before kiosk protection can be enabled', async () => {
  const result = await post('/api/admin/users', {
    name: 'Kid',
    displayName: 'Kid',
    role: 'CHILD',
    kioskPinRequired: true,
  });
  expect(result.statusCode).toBe(400);
});
it('returns only the selected member’s kiosk history without private notes or medicine names', async () => {
  const first = await prescription();
  const second = await prescription();
  await post(`/api/doses/${first.doseId}/actions`, {
    action: 'TAKE',
    notes: 'Private parent note',
  });
  const data = (await app.inject(`/api/kiosk/profiles/${first.userId}`)).json();
  expect(data.history).toHaveLength(1);
  expect(data.history[0]).toMatchObject({
    id: first.doseId,
    status: 'TAKEN',
    displayName: 'Morning Medicine',
  });
  expect(JSON.stringify(data.history)).not.toContain(second.doseId);
  expect(JSON.stringify(data)).not.toContain('Private parent note');
  expect(JSON.stringify(data.history)).not.toContain('Private fake medicine');
});

it('records as-needed use idempotently without scheduled doses or reward points', async () => {
  const child = (
    await post('/api/admin/users', {
      name: 'PRN demo',
      displayName: 'PRN demo',
      role: 'CHILD',
    })
  ).json();
  const medication = (
    await post('/api/admin/medications', {
      userId: child.id,
      name: 'Private PRN name',
      displayName: 'As-needed demo',
      doseDisplay: 'Prescribed amount',
      usageType: 'AS_NEEDED',
    })
  ).json();
  const payload = {
    requestId: crypto.randomUUID(),
    doseDisplay: 'Recorded demo amount',
  };
  const record = await post(
    `/api/as-needed/${medication.id}/uses`,
    payload,
    false,
  );
  expect(record.statusCode).toBe(200);
  expect(
    (await post(`/api/as-needed/${medication.id}/uses`, payload, false)).json()
      .alreadyRecorded,
  ).toBe(true);
  const profile = (await app.inject(`/api/kiosk/profiles/${child.id}`)).json();
  expect(profile.asNeeded).toHaveLength(1);
  expect(profile.asNeeded[0].lastUsedAt).toBe(now);
  expect(profile.doses).toHaveLength(0);
  expect(profile.profile.total).toBe(0);
  expect(profile.profile.rewardPoints).toBe(0);
  expect(profile.history).toHaveLength(1);
  expect(profile.history[0]).toMatchObject({
    asNeeded: true,
    doseDisplay: payload.doseDisplay,
    displayName: 'As-needed demo',
  });
  expect(JSON.stringify(profile)).not.toContain('Private PRN name');
  expect(
    (
      await post('/api/admin/schedules', {
        medicationId: medication.id,
        scheduleType: 'MORNING',
        timeOfDay: '08:00',
        startDate: '2026-09-09',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      })
    ).statusCode,
  ).toBe(400);
});
it('requires adult confirmation for supervised as-needed use and respects kiosk protection', async () => {
  const child = (
    await post('/api/admin/users', {
      name: 'PRN demo',
      displayName: 'PRN demo',
      role: 'CHILD',
      pin: '123456',
      kioskPinRequired: true,
    })
  ).json();
  const medication = (
    await post('/api/admin/medications', {
      userId: child.id,
      name: 'PRN',
      displayName: 'PRN',
      doseDisplay: 'Demo',
      usageType: 'AS_NEEDED',
      requiresSupervision: true,
    })
  ).json();
  const payload = {
    requestId: crypto.randomUUID(),
    doseDisplay: 'Demo amount',
  };
  expect(
    (await post(`/api/as-needed/${medication.id}/uses`, payload, false))
      .statusCode,
  ).toBe(401);
  expect(
    (await post(`/api/as-needed/${medication.id}/uses`, payload)).statusCode,
  ).toBe(200);
  expect(store.db.select().from(rewardEvents).all()).toHaveLength(0);
});

it('deduplicates push alerts, backs off failures, and removes expired subscriptions', async () => {
  const { PushService, pendingAlerts, subscriptionSchema } =
    await import('./domain/push');
  const { FamilyService } = await import('./domain/service');
  const { pushSubscriptions, pushDeliveries } =
    await import('@family/database');
  const { doseId } = await prescription();
  const connection = await post('/api/kiosk/connect', {}, false);
  const deviceCookie = connection.cookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/test',
    keys: { p256dh: 'a'.repeat(87), auth: 'a'.repeat(22) },
  };
  expect(
    subscriptionSchema.safeParse({
      ...subscription,
      endpoint: 'https://127.0.0.1/private',
    }).success,
  ).toBe(false);
  expect(
    subscriptionSchema.safeParse({
      ...subscription,
      endpoint: 'https://fcm.googleapis.com.evil.test/private',
    }).success,
  ).toBe(false);
  expect(
    (await post('/api/push/subscribe', subscription, false)).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/push/subscribe',
        headers: { ...headers, cookie: deviceCookie },
        payload: subscription,
      })
    ).statusCode,
  ).toBe(200);
  const service = new FamilyService(store, () => now);
  let sends = 0;
  let failure = 0;
  const push = new PushService(service, async (_subscription, payload) => {
    sends++;
    expect(payload).not.toContain('Private fake medicine');
    expect(payload).not.toContain('Kid');
    if (failure) throw { statusCode: failure };
  });
  await push.tick();
  await push.tick();
  expect(sends).toBe(1);
  expect(store.db.select().from(pushDeliveries).all()).toHaveLength(1);
  store.db
    .update(doses)
    .set({ status: 'SNOOZED', snoozedUntil: '2026-09-09T14:30:00.000Z' })
    .where(eq(doses.id, doseId))
    .run();
  expect(pendingAlerts(service)).toHaveLength(0);
  now = '2026-09-09T14:31:00.000Z';
  failure = 503;
  await push.tick();
  await push.tick();
  expect(sends).toBe(2);
  expect(store.db.select().from(pushSubscriptions).get()?.retryAt).toBeTruthy();
  now = '2026-09-09T14:32:00.000Z';
  failure = 410;
  await push.tick();
  expect(store.db.select().from(pushSubscriptions).all()).toHaveLength(0);
  const config = (await app.inject('/api/push/config')).json();
  expect(config.publicKey).toBeTruthy();
  expect(config.privateKey).toBeUndefined();
});
