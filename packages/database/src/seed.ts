import { openDatabase, rewardDefinitions } from './index';
import { randomUUID } from 'node:crypto';
import { FamilyService } from '../../../apps/api/src/domain/service';
import { pinSchema } from '@family/shared';
const pin = pinSchema.parse(process.env.DEMO_PIN);
const store = openDatabase();
const service = new FamilyService(store, () => new Date().toISOString());
const setup = await service.setup({
  name: 'The demo family',
  timezone: process.env.HOUSEHOLD_TIMEZONE ?? 'America/New_York',
  adult: {
    name: 'Parent',
    displayName: 'Parent',
    avatar: 'sun',
    role: 'ADULT',
    pin,
    active: true,
  },
});
const family = [
  { id: setup.adultId, displayName: 'Parent' },
  {
    ...(await service.saveUser(
      {
        name: 'Mom',
        displayName: 'Mom',
        avatar: 'flower',
        role: 'ADULT',
        pin,
        active: true,
      },
      setup.adultId,
    )),
  },
  {
    ...(await service.saveUser(
      {
        name: 'Kid 1',
        displayName: 'Kid 1',
        avatar: 'star',
        role: 'CHILD',
        active: true,
      },
      setup.adultId,
    )),
  },
  {
    ...(await service.saveUser(
      {
        name: 'Kid 2',
        displayName: 'Kid 2',
        avatar: 'leaf',
        role: 'CHILD',
        active: true,
      },
      setup.adultId,
    )),
  },
];
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: service.household().timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
for (const [index, user] of family.entries()) {
  const { id } = service.saveMedication(
    {
      userId: user.id,
      name: 'Demo Morning Medicine',
      displayName: 'Morning Medicine',
      usageType: 'SCHEDULED',
      doseDisplay: '1 demo tablet',
      instructions: 'Demo only. Take with water.',
      image: null,
      active: true,
      privacyMode: true,
      requiresSupervision: index === 3,
    },
    setup.adultId,
  );
  service.saveSchedule(
    {
      medicationId: id,
      scheduleType: 'MORNING',
      timeOfDay: process.env.DEMO_REMINDER_TIME ?? '08:00',
      exactTime: null,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      startDate: today,
      endDate: null,
      gracePeriodMinutes: 60,
      active: true,
    },
    setup.adultId,
  );
  store.sqlite.transaction(() =>
    service.rewards.credit(
      user.id,
      [12, 18, 7, 22][index],
      'Demo starting balance',
      'DEMO',
      user.id,
      service.now(),
    ),
  )();
}
for (const [name, pointCost] of [
  ['Dessert choice', 25],
  ['Movie choice', 50],
  ['Game credit', 100],
  ['Special activity', 200],
] as const)
  store.db
    .insert(rewardDefinitions)
    .values({
      id: randomUUID(),
      householdId: service.household().id,
      name,
      pointCost,
      description: 'Choose together with your adult.',
      active: true,
      createdAt: service.now(),
      updatedAt: service.now(),
    })
    .run();
console.log('Demo family created. Adults use the DEMO_PIN you supplied.');
store.sqlite.close();
