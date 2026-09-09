import { describe, it, expect } from 'vitest';
import { scheduledInstant, streaks } from './time';
import { nextStatus } from './transitions';
const schedule = {
  startDate: '2026-01-01',
  endDate: null,
  daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  scheduleType: 'EXACT_TIME' as const,
  timeOfDay: '08:00',
  exactTime: '08:00',
};
describe('explicit schedules', () => {
  it('uses the household timezone and date bounds', () => {
    expect(scheduledInstant(schedule, '2026-09-09', 'America/New_York')).toBe(
      '2026-09-09T12:00:00.000Z',
    );
    expect(
      scheduledInstant(
        { ...schedule, daysOfWeek: [1] },
        '2026-09-09',
        'America/New_York',
      ),
    ).toBeNull();
    expect(scheduledInstant(schedule, '2025-12-31', 'UTC')).toBeNull();
  });
  it('creates one occurrence through both daylight saving changes', () => {
    expect(
      scheduledInstant(
        { ...schedule, exactTime: '02:30' },
        '2026-03-08',
        'America/New_York',
      ),
    ).toBe('2026-03-08T07:30:00.000Z');
    expect(
      scheduledInstant(
        { ...schedule, exactTime: '01:30' },
        '2026-11-01',
        'America/New_York',
      ),
    ).toBe('2026-11-01T05:30:00.000Z');
  });
});
describe('dose permission and state rules', () => {
  it('requires an adult for supervised completion and skipping', () => {
    expect(() => nextStatus('DUE', 'TAKE', true, false)).toThrow('Adult');
    expect(nextStatus('DUE', 'READY', true, false)).toBe(
      'AWAITING_SUPERVISION',
    );
    expect(() =>
      nextStatus('AWAITING_SUPERVISION', 'CONFIRM', true, false),
    ).toThrow();
    expect(nextStatus('AWAITING_SUPERVISION', 'CONFIRM', true, true)).toBe(
      'TAKEN',
    );
    expect(() => nextStatus('DUE', 'SKIP', false, false)).toThrow();
  });
  it('rejects duplicate terminal actions and permits snoozing', () => {
    expect(() => nextStatus('TAKEN', 'TAKE', false, true)).toThrow();
    expect(nextStatus('DUE', 'SNOOZE', false, false)).toBe('SNOOZED');
  });
});
it('counts complete calendar days, breaks gaps, and keeps yesterday while today is pending', () => {
  const records = [
    { scheduledAt: '2026-09-07T12:00:00Z', status: 'TAKEN' as const },
    { scheduledAt: '2026-09-08T12:00:00Z', status: 'TAKEN' as const },
    { scheduledAt: '2026-09-09T12:00:00Z', status: 'DUE' as const },
  ];
  expect(streaks(records, 'UTC', '2026-09-09T14:00:00Z')).toEqual({
    current: 2,
    longest: 2,
  });
  expect(streaks(records, 'UTC', '2026-09-11T14:00:00Z').current).toBe(0);
});
