import { AvatarPicker } from '../components/AvatarPicker';
import { Select } from '../components/Select';
import { useState } from 'react';
import { Plus, LockKeyhole } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { Editor, Field, Toggle, str, save } from './Form';
import type { AdminData, FamilyUser } from './types';
export function Users({ data }: { data: AdminData }) {
  const [editing, setEditing] = useState<FamilyUser | null | undefined>();
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">EVERYONE AT HOME</p>
          <h1>Family members</h1>
        </div>
        <button className="button primary" onClick={() => setEditing(null)}>
          <Plus />
          Add family member
        </button>
      </div>
      {editing !== undefined && (
        <Editor
          key={editing?.id ?? 'new'}
          title={editing ? 'Edit family member' : 'Add family member'}
          onCancel={() => setEditing(undefined)}
          onSave={async (f) => {
            await save('/admin/users', editing?.id, {
              name: str(f, 'name'),
              displayName: str(f, 'displayName'),
              role: str(f, 'role'),
              avatar: str(f, 'avatar'),
              feedbackStyle: str(f, 'feedbackStyle'),
              soundEnabled: f.has('soundEnabled'),
              pin: str(f, 'pin') || undefined,
              active: f.has('active'),
              kioskPinRequired: f.has('kioskPinRequired'),
            });
          }}
        >
          <div className="form-grid">
            <Field name="name" label="Name" value={editing?.name} />
            <Field
              name="displayName"
              label="Name on kiosk"
              value={editing?.displayName}
            />
            <label>
              Role
              <Select name="role" defaultValue={editing?.role ?? 'CHILD'}>
                <option value="CHILD">Child</option>
                <option value="ADULT">Adult</option>
              </Select>
            </label>
          </div>
          <AvatarPicker initial={editing?.avatar} />
          <fieldset className="feedback-settings">
            <legend>Completion feedback</legend>
            <label>
              Celebration style
              <Select
                name="feedbackStyle"
                defaultValue={editing?.feedbackStyle ?? 'AUTO'}
              >
                <option value="AUTO">
                  Automatic: playful for children, quiet for adults
                </option>
                <option value="PLAYFUL">Playful: sparkles and confetti</option>
                <option value="QUIET">Quiet: a simple check and points</option>
                <option value="OFF">Off: recording confirmation only</option>
              </Select>
            </label>
            <Toggle
              name="soundEnabled"
              label="Play a soft completion chime"
              checked={editing?.soundEnabled ?? false}
            />
            <p className="page-note">
              Sound is off by default. Reduced-motion settings disable
              celebration animations. Points still count with celebrations off.
            </p>
          </fieldset>
          <label>
            {editing
              ? 'New PIN, leave blank to keep current PIN'
              : 'PIN, required for adults'}
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,12}"
              maxLength={12}
              autoComplete="new-password"
            />
          </label>
          <Toggle
            name="kioskPinRequired"
            label="Require a PIN to open this member’s kiosk profile"
            checked={editing?.kioskPinRequired ?? false}
          />
          <p className="page-note">
            Kiosk access is open by default. Admin controls and adult
            confirmations still require an adult PIN.
          </p>
          <Toggle
            name="active"
            label="Active family member"
            checked={editing?.active ?? true}
          />
        </Editor>
      )}
      <div className="member-grid">
        {data.users.map((u) => (
          <article
            className={`panel member-card ${u.active ? '' : 'inactive'}`}
            key={u.id}
          >
            <Avatar name={u.avatar} />
            <div>
              <h2>{u.displayName}</h2>
              <p>
                {u.role === 'ADULT' ? 'Adult' : 'Child'} ·{' '}
                {u.active ? 'Active' : 'Disabled'}
              </p>
              {u.hasPin && (
                <small>
                  <LockKeyhole size={13} />{' '}
                  {u.kioskPinRequired
                    ? 'Kiosk PIN enabled'
                    : u.role === 'ADULT'
                      ? 'Admin PIN set'
                      : 'PIN set; kiosk open'}
                </small>
              )}
            </div>
            <button className="button secondary" onClick={() => setEditing(u)}>
              Edit
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
