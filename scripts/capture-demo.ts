import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import {
  openDatabase,
  migrate,
  rewardDefinitions,
} from '../packages/database/src/index';
import { FamilyService } from '../apps/api/src/domain/service';
import { createApp } from '../apps/api/src/app';
import { recordAsNeeded } from '../apps/api/src/domain/as-needed';
import {
  setupSchema,
  userSchema,
  medicationSchema,
  scheduleSchema,
} from '../packages/shared/src/index';

// This demo owns an in-memory database. It never opens DATABASE_PATH or the Docker volume.
const store = openDatabase(':memory:');
migrate(store.db, { migrationsFolder: 'packages/database/migrations' });
let now = '2026-09-03T07:00:00.000Z';
const service = new FamilyService(store, () => now);
const pin = '246810';
const setup = await service.setup(
  setupSchema.parse({
    name: 'The demo family',
    timezone: 'UTC',
    adult: {
      name: 'Alex',
      displayName: 'Alex',
      role: 'ADULT',
      pin,
      avatar: 'person-5:sky',
    },
  }),
);
const family = [service.user(setup.adultId)];
for (const [name, role, avatar] of [
  ['Jamie', 'ADULT', 'person-12:rose'],
  ['Riley', 'CHILD', 'person-2:gold'],
  ['Sam', 'CHILD', 'person-15:lavender'],
]) {
  const member = await service.saveUser(
    userSchema.parse({
      name,
      displayName: name,
      role,
      avatar,
      ...(role === 'ADULT' ? { pin } : {}),
    }),
    setup.adultId,
  );
  family.push(service.user(member.id));
}
for (const member of family) {
  const med = service.saveMedication(
    medicationSchema.parse({
      userId: member.id,
      name: 'Fictional morning medication',
      displayName: 'Morning medicine',
      doseDisplay: '1 demo tablet',
      instructions: 'Fictional example for the demo. Take with water.',
      requiresSupervision: member.displayName === 'Sam',
    }),
    setup.adultId,
  );
  service.saveSchedule(
    scheduleSchema.parse({
      medicationId: med.id,
      scheduleType: 'MORNING',
      timeOfDay: '08:00',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      startDate: '2026-09-03',
      gracePeriodMinutes: 30,
    }),
    setup.adultId,
  );
  if (member.displayName === 'Jamie') {
    const evening = service.saveMedication(
      medicationSchema.parse({
        userId: member.id,
        name: 'Fictional evening medication',
        displayName: 'Evening medicine',
        doseDisplay: '1 demo tablet',
        instructions: 'Fictional example for the demo.',
      }),
      setup.adultId,
    );
    service.saveSchedule(
      scheduleSchema.parse({
        medicationId: evening.id,
        scheduleType: 'EVENING',
        timeOfDay: '19:00',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        startDate: '2026-09-03',
      }),
      setup.adultId,
    );
  }
}
const riley = family[2]!;
const asNeeded = service.saveMedication(
  medicationSchema.parse({
    userId: riley.id,
    name: 'Fictional as-needed medication',
    displayName: 'As-needed medicine',
    doseDisplay: 'Demo amount',
    instructions: 'A fictional example of a medicine recorded only when used.',
    usageType: 'AS_NEEDED',
  }),
  setup.adultId,
);
for (let day = 3; day <= 8; day++) {
  now = `2026-09-${String(day).padStart(2, '0')}T20:00:00.000Z`;
  service.scheduler.generate();
  for (const dose of service
    .todayDoses()
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))) {
    now = new Date(
      Date.parse(dose.scheduledAt) + (day === 6 ? 45 : 5) * 60000,
    ).toISOString();
    service.act(dose.id, { action: 'TAKE' }, family[0]!);
  }
}
recordAsNeeded(
  service,
  asNeeded.id,
  { requestId: randomUUID(), doseDisplay: 'Demo amount' },
  family[0]!,
);
now = '2026-09-09T09:15:00.000Z';
service.scheduler.generate();
for (const dose of service.todayDoses()) {
  if (dose.scheduledAt > now) continue;
  if ([family[0]!.id, family[1]!.id].includes(dose.userId))
    service.act(dose.id, { action: 'TAKE' }, family[0]!);
  if (dose.userId === family[3]!.id)
    service.act(dose.id, { action: 'READY' }, null);
}
for (const [name, description, pointCost] of [
  ['Pick family movie night', 'Choose a movie to watch together.', 60],
  ['Choose dessert', 'Pick a favorite treat for the family.', 100],
  [
    'Plan a family adventure',
    'Choose a park, outing, or activity together.',
    150,
  ],
] as const)
  store.db
    .insert(rewardDefinitions)
    .values({
      id: randomUUID(),
      householdId: service.household().id,
      name,
      description,
      pointCost,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

const app = createApp(store, { now: () => now });
await app.listen({ host: '127.0.0.1', port: 3201 });
const preview = spawn(
  'pnpm',
  [
    '--filter',
    '@family/web',
    'exec',
    'vite',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '3200',
    '--strictPort',
  ],
  {
    env: { ...process.env, API_TARGET: 'http://127.0.0.1:3201' },
    stdio: 'inherit',
  },
);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function cleanup() {
  await browser?.close();
  preview.kill('SIGTERM');
  await app.close();
  store.sqlite.close();
}
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch('http://127.0.0.1:3200/api/health')).ok) break;
    } catch {
      /* Preview is starting. */
    }
    if (attempt >= 100) throw new Error('Demo preview failed to start');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.clock.setFixedTime(new Date(now));
  mkdirSync('docs/images', { recursive: true });
  async function capture(name: string) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/images/${name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.goto('http://127.0.0.1:3200/kiosk');
  await expect(
    page.getByRole('heading', { name: 'Your family' }),
  ).toBeVisible();
  await capture('family-kiosk');
  await page.goto(`http://127.0.0.1:3200/kiosk/profile/${riley.id}`);
  await expect(
    page.getByRole('heading', { name: 'As needed', exact: true }),
  ).toBeVisible();
  await capture('member-day');
  await page.goto(`http://127.0.0.1:3200/kiosk/profile/${riley.id}/rewards`);
  await expect(
    page.getByRole('heading', { name: 'Your rewards.' }),
  ).toBeVisible();
  await capture('reward-store');
  await page.goto('http://127.0.0.1:3200/admin');
  await page.getByLabel('PIN', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Today, together.' }),
  ).toBeVisible();
  await capture('parent-dashboard');
  await page.goto('http://127.0.0.1:3200/kiosk');
  await expect(
    page.getByRole('heading', { name: 'Your family' }),
  ).toBeVisible();
  await page.goto(`http://127.0.0.1:3200/kiosk/profile/${riley.id}`);
  await page.getByRole('button', { name: 'I TOOK IT', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'All done for today!', exact: true }),
  ).toBeVisible();
  await capture('daily-celebration');
  await browser.close();
  browser = undefined;
  console.log('Captured five screens with fictional demo data.');
  if (process.argv.includes('--serve')) {
    console.log(
      'Demo is running at http://127.0.0.1:3200. Fictional adult PIN: 246810. Stop with Ctrl+C.',
    );
    process.once('SIGINT', () => {
      void cleanup();
    });
    process.once('SIGTERM', () => {
      void cleanup();
    });
  } else await cleanup();
} catch (error) {
  await cleanup();
  throw error;
}
