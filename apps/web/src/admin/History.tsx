import { Select } from '../components/Select';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, refresh } from '../api';
import { type AdminData, formatTime } from './types';
export function History({ data }: { data: AdminData }) {
  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: string }) =>
      api(`/doses/${id}/actions`, 'POST', {
        action: kind,
        notes: 'Updated by an adult from dose history',
      }),
    onSuccess: refresh,
  });
  const records = [
    ...data.history,
    ...data.today.filter((d) => !data.history.some((h) => h.id === d.id)),
  ].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const [person, setPerson] = useState(''),
    [tab, setTab] = useState('doses');
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">THE HOUSEHOLD RECORD</p>
          <h1>History</h1>
        </div>
        <Select
          className="period-select"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          aria-label="Filter history by family member"
        >
          <option value="">Everyone</option>
          {data.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </Select>
      </div>
      <section className="panel prn-history" aria-label="As-needed history">
        <h2>As-needed use</h2>
        {data.asNeededHistory
          .filter((r) => !person || r.userId === person)
          .map((r) => (
            <p key={r.id}>
              {formatTime(r.usedAt, data.household.timezone, true)} ·{' '}
              {data.users.find((u) => u.id === r.userId)?.displayName} ·{' '}
              {r.displayName} · {r.doseDisplay} ·{' '}
              {r.confirmationType === 'PARENT'
                ? 'Adult confirmed'
                : 'Self recorded'}
            </p>
          ))}
        {!data.asNeededHistory.some((r) => !person || r.userId === person) && (
          <p>No as-needed use recorded.</p>
        )}
      </section>
      <div className="tab-row">
        {[
          ['doses', 'Dose history'],
          ['audit', 'Admin audit'],
          ['points', 'Points ledger'],
        ].map(([key, label]) => (
          <button
            className={`button ${tab === key ? 'primary' : 'secondary'}`}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {action.error && (
        <p className="error" role="alert">
          {action.error.message}
        </p>
      )}
      <div className="panel table-wrap">
        {tab === 'doses' ? (
          <table>
            <caption>Last 30 days and today's scheduled doses</caption>
            <thead>
              <tr>
                <th>Scheduled</th>
                <th>Person</th>
                <th>Medicine</th>
                <th>Status</th>
                <th>Acknowledged</th>
                <th>Adult actions</th>
              </tr>
            </thead>
            <tbody>
              {records
                .filter((d) => !person || d.userId === person)
                .map((d) => (
                  <tr key={d.id}>
                    <td>
                      {formatTime(d.scheduledAt, data.household.timezone, true)}
                    </td>
                    <td>
                      {data.users.find((u) => u.id === d.userId)?.displayName}
                    </td>
                    <td>
                      {d.displayName}
                      <small>{d.doseDisplay}</small>
                    </td>
                    <td>{d.status.replaceAll('_', ' ')}</td>
                    <td>
                      {d.acknowledgedAt
                        ? formatTime(
                            d.acknowledgedAt,
                            data.household.timezone,
                            true,
                          )
                        : 'Not recorded'}
                    </td>
                    <td>
                      {!['TAKEN', 'SKIPPED'].includes(d.status) && (
                        <div className="history-actions">
                          {d.scheduledAt <= new Date().toISOString() && (
                            <button
                              className="button secondary"
                              disabled={action.isPending}
                              onClick={() =>
                                action.mutate({
                                  id: d.id,
                                  kind:
                                    d.status === 'AWAITING_SUPERVISION'
                                      ? 'CONFIRM'
                                      : 'TAKE',
                                })
                              }
                            >
                              Mark taken
                            </button>
                          )}
                          <button
                            className="button secondary"
                            disabled={action.isPending}
                            onClick={() =>
                              action.mutate({ id: d.id, kind: 'SKIP' })
                            }
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : tab === 'audit' ? (
          <table>
            <caption>Latest 200 administrative and dose actions</caption>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.audit
                .filter(
                  (a) => !person || a.actor === person || a.target === person,
                )
                .map((a) => (
                  <tr key={a.id}>
                    <td>
                      {formatTime(a.timestamp, data.household.timezone, true)}
                    </td>
                    <td>
                      {data.users.find((u) => u.id === a.actor)?.displayName ??
                        (a.actor.startsWith('kiosk:')
                          ? 'Kiosk acknowledgement'
                          : a.actor)}
                    </td>
                    <td>{a.action}</td>
                    <td>
                      <details>
                        <summary>View record</summary>
                        <pre>
                          {JSON.stringify(JSON.parse(a.metadata), null, 2)}
                        </pre>
                        <small>Record {a.target}</small>
                      </details>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <table>
            <caption>Latest 200 reward transactions</caption>
            <thead>
              <tr>
                <th>When</th>
                <th>Person</th>
                <th>Points</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.rewardEvents
                .filter((e) => !person || e.userId === person)
                .map((e) => (
                  <tr key={e.id}>
                    <td>
                      {formatTime(e.createdAt, data.household.timezone, true)}
                    </td>
                    <td>
                      {data.users.find((u) => u.id === e.userId)?.displayName}
                    </td>
                    <td>
                      {e.points > 0 ? '+' : ''}
                      {e.points}
                    </td>
                    <td>{e.reason}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
