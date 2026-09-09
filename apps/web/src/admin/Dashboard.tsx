import { Select } from '../components/Select';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Clock, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, refresh } from '../api';
import { Avatar } from '../components/Avatar';
import { Status, Progress } from '../components/Status';
import { type AdminData, formatTime } from './types';
export function Dashboard({ data }: { data: AdminData }) {
  const [days, setDays] = useState(7);
  const analytics = useQuery({
    queryKey: ['analytics', days],
    queryFn: () =>
      api<{
        takenOnTime: number;
        takenLate: number;
        skipped: number;
        missed: number;
        averageDelay: number;
        profiles: {
          id: string;
          displayName: string;
          current: number;
          longest: number;
        }[];
      }>(`/admin/analytics?days=${days}`),
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api(`/doses/${id}/actions`, 'POST', {
        action,
        minutes: 10,
        notes: notes[id] ?? '',
      }),
    onSuccess: refresh,
  });
  const now = Date.now();
  const needs = data.today.filter(
    (d) =>
      d.scheduledAt <= new Date().toISOString() &&
      ['DUE', 'SNOOZED', 'AWAITING_SUPERVISION'].includes(d.status) &&
      (d.status === 'AWAITING_SUPERVISION' ||
        now > Date.parse(d.scheduledAt) + d.gracePeriodMinutes * 60000),
  );
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">A LOOK AT YOUR HOUSEHOLD</p>
          <h1>Today, together.</h1>
        </div>
        <Link to="/kiosk" className="button secondary">
          Open kiosk
          <ArrowUpRight />
        </Link>
      </div>
      <div className="overview-grid">
        {data.profiles.map((p) => (
          <article className="panel overview-card" key={p.id}>
            <div className="overview-name">
              <Avatar name={p.avatar} />
              <h2>{p.displayName}</h2>
            </div>
            <Status profile={p} />
            <Progress complete={p.complete} total={p.total} />
          </article>
        ))}
      </div>
      <section className="dashboard-section">
        <div className="section-title">
          <h2>Needs attention</h2>
          <span className="quiet-pill">
            {needs.length} {needs.length === 1 ? 'reminder' : 'reminders'}
          </span>
        </div>
        {needs.length ? (
          <div className="stack">
            {needs.map((d) => (
              <article className="panel overdue-card" key={d.id}>
                <div className="overdue-title">
                  <AlertCircle />
                  <div>
                    <h3>
                      {data.users.find((u) => u.id === d.userId)?.displayName} ·{' '}
                      {d.displayName}
                    </h3>
                    <p>
                      {d.doseDisplay} · Due{' '}
                      {formatTime(d.scheduledAt, data.household.timezone)} ·{' '}
                      {d.status === 'AWAITING_SUPERVISION'
                        ? 'Waiting for parent'
                        : `${Math.floor((now - Date.parse(d.scheduledAt)) / 60000)} minutes since scheduled time`}
                    </p>
                  </div>
                </div>
                <label>
                  Note for the record
                  <input
                    value={notes[d.id] ?? ''}
                    onChange={(e) =>
                      setNotes({ ...notes, [d.id]: e.target.value })
                    }
                    maxLength={500}
                    placeholder="Optional context"
                  />
                </label>
                <div className="action-row">
                  <button
                    className="button primary"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        id: d.id,
                        action:
                          d.status === 'AWAITING_SUPERVISION'
                            ? 'CONFIRM'
                            : 'TAKE',
                      })
                    }
                  >
                    <Check />
                    Mark taken
                  </button>
                  <button
                    className="button secondary"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: d.id, action: 'SKIP' })}
                  >
                    Skip
                  </button>
                  <button
                    className="button secondary"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ id: d.id, action: 'SNOOZE' })
                    }
                  >
                    <Clock />
                    Snooze 10 min
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel calm-state">
            <Check />
            <p>No overdue doses or pending confirmations.</p>
          </div>
        )}
        {action.error && (
          <p className="error" role="alert">
            {action.error.message}
          </p>
        )}
      </section>
      <section className="dashboard-section">
        <div className="section-title">
          <h2>Recorded acknowledgements</h2>
          <Select
            className="period-select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Analytics period"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </Select>
        </div>
        {analytics.data && (
          <>
            <div className="metrics">
              {[
                ['On time', analytics.data.takenOnTime],
                ['Late', analytics.data.takenLate],
                ['Skipped', analytics.data.skipped],
                ['Missed', analytics.data.missed],
                ['Avg. delay', `${analytics.data.averageDelay} min`],
              ].map(([label, value]) => (
                <div className="panel metric" key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="streak-row">
              {analytics.data.profiles.map((p) => (
                <p key={p.id}>
                  {p.displayName}: {p.current} day streak · best {p.longest}
                </p>
              ))}
            </div>
          </>
        )}
        <p className="page-note">
          These counts describe recorded acknowledgements. They do not verify
          ingestion or measure medical outcomes.
        </p>
      </section>
      <section className="dashboard-section">
        <div className="section-title">
          <h2>Recent activity</h2>
          <Link to="/admin/history" className="text-button">
            View history
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="panel activity-list">
          {data.history
            .filter((d) => d.acknowledgedAt)
            .sort((a, b) => b.acknowledgedAt!.localeCompare(a.acknowledgedAt!))
            .slice(0, 5)
            .map((d) => (
              <div key={d.id}>
                <span>
                  {formatTime(d.acknowledgedAt!, data.household.timezone)}
                </span>
                <strong>
                  {data.users.find((u) => u.id === d.userId)?.displayName}
                </strong>
                <span>{d.displayName}</span>
                <span className="status done">
                  <Check size={16} />
                  Taken
                </span>
              </div>
            ))}
          {!data.history.some((d) => d.acknowledgedAt) && (
            <p className="page-note">No acknowledgements recorded yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
