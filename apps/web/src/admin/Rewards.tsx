import { Select } from '../components/Select';
import { useState } from 'react';
import { Gift, Plus, SlidersHorizontal } from 'lucide-react';
import type { Reward } from '@family/shared';
import { api } from '../api';
import { Editor, Field, Toggle, str, save } from './Form';
import type { AdminData } from './types';
export function Rewards({ data }: { data: AdminData }) {
  const [editing, setEditing] = useState<Reward | null | undefined>(),
    [settings, setSettings] = useState(false),
    [adjust, setAdjust] = useState(false),
    [requestId, setRequestId] = useState(crypto.randomUUID());
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">SMALL WINS, TOGETHER</p>
          <h1>Family rewards</h1>
        </div>
        <button className="button primary" onClick={() => setEditing(null)}>
          <Plus />
          Add reward
        </button>
      </div>
      <div className="action-row reward-tools">
        <button
          className="button secondary"
          onClick={() => setSettings(!settings)}
        >
          <SlidersHorizontal />
          Point values
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setRequestId(crypto.randomUUID());
            setAdjust(true);
          }}
        >
          Adjust points
        </button>
      </div>
      {settings && (
        <Editor
          title="Point values"
          onCancel={() => setSettings(false)}
          onSave={async (f) => {
            await api(
              '/admin/reward-settings',
              'PUT',
              Object.fromEntries(
                ['medication', 'daily', 'sevenDay', 'thirtyDay'].map((k) => [
                  k,
                  Number(str(f, k)),
                ]),
              ),
            );
          }}
        >
          <div className="form-grid">
            <Field
              name="medication"
              label="Each medication acknowledged"
              type="number"
              value={data.rewardSettings.medication}
            />
            <Field
              name="daily"
              label="All medicines completed for the day"
              type="number"
              value={data.rewardSettings.daily}
            />
            <Field
              name="sevenDay"
              label="Every 7 day streak milestone"
              type="number"
              value={data.rewardSettings.sevenDay}
            />
            <Field
              name="thirtyDay"
              label="Every 30 day streak milestone"
              type="number"
              value={data.rewardSettings.thirtyDay}
            />
          </div>
          <p className="page-note">
            New values apply to future awards. Existing transactions stay in the
            ledger.
          </p>
        </Editor>
      )}
      {adjust && (
        <Editor
          title="Adjust points"
          onCancel={() => setAdjust(false)}
          onSave={async (f) => {
            await api('/admin/points', 'POST', {
              userId: str(f, 'userId'),
              points: Number(str(f, 'points')),
              reason: str(f, 'reason'),
              requestId,
            });
          }}
        >
          <label>
            Family member
            <Select name="userId">
              {data.users
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} · {u.rewardPoints} points
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Points to add or subtract
            <input
              type="number"
              name="points"
              min={-10000}
              max={10000}
              required
            />
          </label>
          <Field name="reason" label="Reason" />
        </Editor>
      )}
      {editing !== undefined && (
        <Editor
          key={editing?.id ?? 'new'}
          title={editing ? 'Edit reward' : 'Add reward'}
          onCancel={() => setEditing(undefined)}
          onSave={async (f) => {
            await save('/admin/rewards', editing?.id, {
              name: str(f, 'name'),
              description: str(f, 'description'),
              pointCost: Number(str(f, 'pointCost')),
              active: f.has('active'),
            });
          }}
        >
          <div className="form-grid">
            <Field name="name" label="Reward name" value={editing?.name} />
            <Field
              name="pointCost"
              label="Point cost"
              type="number"
              value={editing?.pointCost ?? 25}
            />
          </div>
          <label>
            Description
            <textarea
              name="description"
              maxLength={500}
              defaultValue={editing?.description}
            />
          </label>
          <Toggle
            name="active"
            label="Available in the reward store"
            checked={editing?.active ?? true}
          />
        </Editor>
      )}
      <div className="reward-grid">
        {data.rewards.map((r) => (
          <article
            className={`panel reward-card ${r.active ? '' : 'inactive'}`}
            key={r.id}
          >
            <span className="reward-art">
              <Gift />
            </span>
            <span className="reward-cost">{r.pointCost} points</span>
            <h2>{r.name}</h2>
            <p>{r.description}</p>
            <button className="button secondary" onClick={() => setEditing(r)}>
              Edit reward
            </button>
          </article>
        ))}
      </div>
      {!data.rewards.length && (
        <div className="panel empty">
          <Gift />
          <h2>Something to look forward to</h2>
          <p>Create a reward your family can choose together.</p>
        </div>
      )}
    </>
  );
}
