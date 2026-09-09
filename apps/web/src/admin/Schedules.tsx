import { Link } from 'react-router-dom';
import { Select } from '../components/Select';
import { useState } from 'react';
import { Plus, Clock } from 'lucide-react';
import { Editor, Field, Toggle, str, save } from './Form';
import type { AdminData, Schedule } from './types';
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function Schedules({ data }: { data: AdminData }) {
  const [editing, setEditing] = useState<Schedule | null | undefined>();
  const canAdd = data.medications.some(
    (m) => m.active && m.usageType !== 'AS_NEEDED',
  );
  const today = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: data.household.timezone,
  }).format(new Date());
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">{data.household.timezone}</p>
          <h1>Schedules</h1>
        </div>
        <button
          className="button primary"
          disabled={!canAdd}
          aria-describedby={!canAdd ? 'schedule-prerequisite' : undefined}
          onClick={() => setEditing(null)}
        >
          <Plus />
          Add schedule
        </button>
      </div>
      {!canAdd && (
        <div className="setup-banner" id="schedule-prerequisite">
          <strong>Add a medication before creating its schedule.</strong>
          <span>
            A schedule needs a medication to remind you about. Add one or enable
            an existing medication to continue.
          </span>
          <Link to="/admin/medications">Add a medication</Link>
        </div>
      )}
      <p className="page-note">
        Every reminder uses the household timezone. Choose an explicit time for
        each named period.
      </p>
      {editing !== undefined && (
        <Editor
          key={editing?.id ?? 'new'}
          title={editing ? 'Edit schedule' : 'Add schedule'}
          onCancel={() => setEditing(undefined)}
          onSave={async (f) => {
            const time = str(f, 'timeOfDay');
            await save('/admin/schedules', editing?.id, {
              medicationId: str(f, 'medicationId'),
              scheduleType: str(f, 'scheduleType'),
              timeOfDay: time,
              exactTime: str(f, 'scheduleType') === 'EXACT_TIME' ? time : null,
              startDate: str(f, 'startDate'),
              endDate: str(f, 'endDate') || null,
              daysOfWeek: f.getAll('days').map(Number),
              gracePeriodMinutes: Number(str(f, 'gracePeriodMinutes')),
              active: f.has('active'),
            });
          }}
        >
          <label>
            Medication
            <Select name="medicationId" defaultValue={editing?.medicationId}>
              {data.medications
                .filter(
                  (m) =>
                    (m.active && m.usageType !== 'AS_NEEDED') ||
                    m.id === editing?.medicationId,
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {data.users.find((u) => u.id === m.userId)?.displayName} ·{' '}
                    {m.displayName}
                  </option>
                ))}
            </Select>
          </label>
          <div className="form-grid">
            <label>
              Period
              <Select
                name="scheduleType"
                defaultValue={editing?.scheduleType ?? 'MORNING'}
              >
                {['MORNING', 'AFTERNOON', 'EVENING', 'EXACT_TIME'].map((p) => (
                  <option key={p} value={p}>
                    {p.replace('_', ' ')}
                  </option>
                ))}
              </Select>
            </label>
            <Field
              name="timeOfDay"
              label="Reminder time"
              type="time"
              value={editing?.exactTime ?? editing?.timeOfDay ?? '08:00'}
            />
            <Field
              name="startDate"
              label="Start date"
              type="date"
              value={editing?.startDate ?? today}
            />
            <Field
              name="endDate"
              label="End date, optional"
              type="date"
              value={editing?.endDate ?? ''}
              required={false}
            />
          </div>
          <fieldset className="day-picker">
            <legend>Days of the week</legend>
            {days.map((d, i) => (
              <label key={d}>
                <input
                  name="days"
                  type="checkbox"
                  value={i + 1}
                  defaultChecked={editing?.daysOfWeek.includes(i + 1) ?? true}
                />
                <span>{d}</span>
              </label>
            ))}
          </fieldset>
          <Field
            name="gracePeriodMinutes"
            label="Minutes before the reminder is shown as overdue"
            type="number"
            value={editing?.gracePeriodMinutes ?? 60}
          />
          <Toggle
            name="active"
            label="Schedule is active"
            checked={editing?.active ?? true}
          />
          {editing && (
            <p className="page-note">
              Changes apply tomorrow. Existing doses today stay in the history.
            </p>
          )}
        </Editor>
      )}
      <div className="stack">
        {data.schedules.map((s) => {
          const m = data.medications.find((m) => m.id === s.medicationId);
          return (
            <article
              className={`panel medication-row ${s.active ? '' : 'inactive'}`}
              key={s.id}
            >
              <span className="row-icon">
                <Clock />
              </span>
              <div>
                <h2>{m?.displayName}</h2>
                <p>
                  {data.users.find((u) => u.id === m?.userId)?.displayName} ·{' '}
                  {s.scheduleType.replace('_', ' ')} at{' '}
                  {s.exactTime ?? s.timeOfDay}
                </p>
                <small>
                  {s.daysOfWeek.map((d) => days[d - 1]).join(', ')} ·{' '}
                  {s.gracePeriodMinutes} min grace ·{' '}
                  {s.active ? 'Active' : 'Disabled'}
                </small>
              </div>
              <button
                className="button secondary"
                onClick={() => setEditing(s)}
              >
                Edit
              </button>
            </article>
          );
        })}
        {!data.schedules.length && (
          <div className="panel empty">
            <Clock />
            <h2>No schedules yet</h2>
            <p>Add a medication first, then set its reminder time.</p>
          </div>
        )}
      </div>
    </>
  );
}
