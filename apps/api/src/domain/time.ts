import { DateTime } from 'luxon';
import type { ScheduleInput, DoseStatus } from '@family/shared';
export function dayAt(iso: string, timezone: string) {
  return DateTime.fromISO(iso, { zone: timezone }).toISODate()!;
}
export function scheduledInstant(
  schedule: Pick<
    ScheduleInput,
    | 'startDate'
    | 'endDate'
    | 'daysOfWeek'
    | 'scheduleType'
    | 'timeOfDay'
    | 'exactTime'
  >,
  date: string,
  timezone: string,
): string | null {
  const day = DateTime.fromISO(date, { zone: timezone });
  if (
    date < schedule.startDate ||
    (schedule.endDate && date > schedule.endDate) ||
    !schedule.daysOfWeek.includes(day.weekday)
  )
    return null;
  const time =
    schedule.scheduleType === 'EXACT_TIME'
      ? schedule.exactTime!
      : schedule.timeOfDay;
  // A spring-forward gap moves to the next valid wall time. A repeated hour creates one occurrence.
  const local = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
  return local.isValid
    ? local
        .getPossibleOffsets()
        .sort((a, b) => a.toMillis() - b.toMillis())[0]
        .toUTC()
        .toISO()!
    : null;
}
export function streaks(
  records: { scheduledAt: string; status: DoseStatus }[],
  timezone: string,
  now: string,
) {
  const days = new Map<string, boolean>();
  for (const r of records) {
    const day = dayAt(r.scheduledAt, timezone);
    days.set(day, (days.get(day) ?? true) && r.status === 'TAKEN');
  }
  const today = dayAt(now, timezone);
  const yesterday = DateTime.fromISO(today).minus({ days: 1 }).toISODate()!;
  let current = 0,
    longest = 0,
    run = 0,
    previous = '';
  for (const [day, complete] of [...days]
    .filter(([day]) => day <= today)
    .sort(([a], [b]) => a.localeCompare(b))) {
    if (complete) {
      run =
        previous &&
        DateTime.fromISO(day).diff(DateTime.fromISO(previous), 'days').days ===
          1
          ? run + 1
          : 1;
      longest = Math.max(longest, run);
      if (day === today || day === yesterday) current = run;
    } else {
      run = 0;
      if (day === yesterday) current = 0;
    }
    previous = day;
  }
  if (days.get(today) === true) return { current, longest };
  if (!days.get(yesterday)) current = 0;
  return { current, longest };
}
