import { Check, Clock, Minus, ShieldCheck } from 'lucide-react';
import type { KioskHistoryDose } from '@family/shared';
export function KioskHistory({
  history,
  timezone,
}: {
  history: KioskHistoryDose[];
  timezone: string;
}) {
  const dateKey = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  const today = dateKey(new Date());
  const anchor = new Date(`${today}T12:00:00Z`);
  const days = Array.from({ length: 7 }, (_, index) =>
    new Date(anchor.getTime() - index * 86400000).toISOString().slice(0, 10),
  );
  return (
    <section className="kiosk-history" aria-label="Your medicine history">
      <div className="family-heading">
        <div>
          <h2>Your week</h2>
          <p>The last seven days of recorded medicines.</p>
        </div>
      </div>
      <div className="history-tiles">
        {days.map((day) => {
          const rows = history.filter(
            (row) => dateKey(new Date(row.scheduledAt)) === day,
          );
          const scheduled = rows.filter((row) => !row.asNeeded);
          const taken = scheduled.filter(
            (row) => row.status === 'TAKEN',
          ).length;
          const uses = rows.filter((r) => r.asNeeded).length;
          const done = scheduled.length > 0 && taken === scheduled.length;
          return (
            <article
              className={`history-tile ${done ? 'complete' : ''}`}
              key={day}
            >
              <header>
                <h3>
                  {day === today
                    ? 'Today'
                    : new Intl.DateTimeFormat('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(`${day}T12:00:00Z`))}
                </h3>
                {done && <Check aria-label="Day complete" size={20} />}
              </header>
              <p className="history-tally">
                {rows.length
                  ? [
                      scheduled.length
                        ? `${taken} of ${scheduled.length} scheduled`
                        : '',
                      uses
                        ? `${uses} as-needed ${uses === 1 ? 'use' : 'uses'}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'No medicines scheduled'}
              </p>
              <ul>
                {rows.map((row) => {
                  const status =
                    row.status === 'TAKEN'
                      ? 'Taken'
                      : row.status === 'SKIPPED'
                        ? 'Skipped'
                        : row.status === 'MISSED'
                          ? 'Not recorded'
                          : row.status === 'SNOOZED'
                            ? 'Snoozed'
                            : row.status === 'AWAITING_SUPERVISION'
                              ? 'Waiting for parent'
                              : new Date(row.scheduledAt) > new Date()
                                ? 'Upcoming'
                                : 'Due';
                  return (
                    <li key={row.id}>
                      <strong>
                        {row.displayName}
                        {row.asNeeded && ' · As needed'}
                      </strong>
                      <span>{row.doseDisplay}</span>
                      <span
                        className={`history-dose-state ${row.status.toLowerCase()}`}
                      >
                        {row.status === 'TAKEN' ? (
                          <Check size={14} />
                        ) : row.status === 'AWAITING_SUPERVISION' ? (
                          <ShieldCheck size={14} />
                        ) : row.status === 'SKIPPED' ? (
                          <Minus size={14} />
                        ) : (
                          <Clock size={14} />
                        )}
                        {status} ·{' '}
                        {new Intl.DateTimeFormat('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: timezone,
                        }).format(
                          new Date(row.acknowledgedAt ?? row.scheduledAt),
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
