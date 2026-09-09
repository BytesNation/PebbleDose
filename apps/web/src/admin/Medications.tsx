import { Select } from '../components/Select';
import { useState } from 'react';
import { Plus, Pill, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { Editor, Field, Toggle, str, save } from './Form';
import type { AdminData, Medication } from './types';
export function Medications({ data }: { data: AdminData }) {
  const [editing, setEditing] = useState<Medication | null | undefined>();
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">ADULT-CONFIGURED ROUTINES</p>
          <h1>Medications</h1>
        </div>
        <button
          className="button primary"
          onClick={() => setEditing(null)}
          disabled={!data.users.some((u) => u.active)}
        >
          <Plus />
          Add medication
        </button>
      </div>
      <p className="page-note">
        Enter the name, dose, and instructions exactly as you want them
        displayed. This app does not calculate or recommend doses.
      </p>
      {editing !== undefined && (
        <Editor
          key={editing?.id ?? 'new'}
          title={editing ? 'Edit medication' : 'Add medication'}
          onCancel={() => setEditing(undefined)}
          onSave={async (f) => {
            let image = editing?.image ?? null;
            const file = f.get('image') as File;
            if (file?.size) {
              const upload = new FormData();
              upload.set('file', file);
              image = (
                await api<{ url: string }>('/admin/images', 'POST', upload)
              ).url;
            }
            if (f.has('removeImage')) image = null;
            await save('/admin/medications', editing?.id, {
              userId: str(f, 'userId'),
              usageType: str(f, 'usageType'),
              name: str(f, 'name'),
              displayName: str(f, 'displayName'),
              doseDisplay: str(f, 'doseDisplay'),
              instructions: str(f, 'instructions'),
              image,
              active: f.has('active'),
              privacyMode: f.has('privacyMode'),
              requiresSupervision: f.has('requiresSupervision'),
            });
          }}
        >
          <div className="form-grid">
            <label>
              Family member
              <Select name="userId" defaultValue={editing?.userId}>
                {data.users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.displayName}
                    </option>
                  ))}
              </Select>
            </label>
            <Field
              name="name"
              label="Medication name, parent view"
              value={editing?.name}
            />
            <Field
              name="displayName"
              label="Display name on kiosk"
              value={editing?.displayName}
            />
            <Field
              name="doseDisplay"
              label="Dose text"
              value={editing?.doseDisplay}
            />
          </div>
          <label>
            Medication use
            <Select
              name="usageType"
              defaultValue={editing?.usageType ?? 'SCHEDULED'}
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="AS_NEEDED">As needed</option>
            </Select>
          </label>
          <label>
            Instructions
            <textarea
              name="instructions"
              defaultValue={editing?.instructions}
              maxLength={500}
            />
          </label>
          <label>
            Medication image, JPEG, PNG or WebP, up to 2 MB
            <input
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
          {editing?.image && (
            <Toggle name="removeImage" label="Remove current image" />
          )}
          <Toggle
            name="privacyMode"
            label="Privacy mode: show only the display name on the kiosk"
            checked={editing?.privacyMode ?? true}
          />
          <Toggle
            name="requiresSupervision"
            label="An adult must confirm each dose"
            checked={editing?.requiresSupervision ?? false}
          />
          <Toggle
            name="active"
            label="Medication is active"
            checked={editing?.active ?? true}
          />
          {editing && (
            <p className="page-note">
              Changes apply to future days. Today's dose text stays in the
              history. Use today's dose controls for any remaining dose.
            </p>
          )}
        </Editor>
      )}
      <div className="stack">
        {data.medications.map((m) => (
          <article
            key={m.id}
            className={`panel medication-row ${m.active ? '' : 'inactive'}`}
          >
            <span className="row-icon">
              <Pill />
            </span>
            <div>
              <h2>{m.displayName}</h2>
              <p>
                {data.users.find((u) => u.id === m.userId)?.displayName} ·{' '}
                {m.name} · {m.doseDisplay}
              </p>
              <small>
                {m.active ? 'Active' : 'Disabled'} ·{' '}
                {m.usageType === 'AS_NEEDED' ? 'As needed' : 'Scheduled'}
                {m.requiresSupervision && (
                  <>
                    {' '}
                    · <ShieldCheck size={13} /> Adult confirmation
                  </>
                )}
                {m.usageType !== 'AS_NEEDED' &&
                  !data.schedules.some(
                    (s) => s.medicationId === m.id && s.active,
                  ) &&
                  ' · No active schedule'}
              </small>
            </div>
            <button className="button secondary" onClick={() => setEditing(m)}>
              Edit
            </button>
          </article>
        ))}
        {!data.medications.length && (
          <div className="panel empty">
            <Pill />
            <h2>Add your first medication</h2>
            <p>
              Choose a family member, then enter the adult-provided
              instructions.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
