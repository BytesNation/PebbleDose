import {
  deviceSoundsEnabled,
  prepareCompletionSound,
  playCompletionSound,
} from '../components/completionSound';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Gift, ArrowLeft, Sparkles, Check } from 'lucide-react';
import type { Reward } from '@family/shared';
import { api, ApiError, refresh } from '../api';
import { PinDialog } from '../components/PinDialog';
export function RewardStore() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { data, error, refetch } = useQuery({
    queryKey: ['rewards', id],
    queryFn: () =>
      api<{
        points: number;
        rewards: Reward[];
        soundEnabled: boolean;
        feedbackStyle: string;
      }>(`/kiosk/profiles/${id}/rewards`),
  });
  const [selected, setSelected] = useState<{
      reward: Reward;
      requestId: string;
    } | null>(null),
    [success, setSuccess] = useState('');
  if (error instanceof ApiError && error.status === 401)
    return (
      <PinDialog
        title="Unlock your profile"
        profileId={id}
        onCancel={() => navigate('/kiosk')}
        onDone={async () => {
          await refetch();
        }}
      />
    );
  if (!data)
    return (
      <main className="loading">
        {error
          ? 'Cannot reach your reward store. Check the local connection.'
          : 'Opening your rewards…'}
      </main>
    );
  return (
    <main className="kiosk-shell">
      <header className="profile-header">
        <Link className="back-link" to={`/kiosk/profile/${id}`}>
          <ArrowLeft />
          Back to my day
        </Link>
        <span className="points-link">
          <Sparkles />
          {data.points} points
        </span>
      </header>
      <section className="reward-intro">
        <p className="eyebrow">SMALL STEPS ADD UP</p>
        <h1>Your rewards.</h1>
        <p>
          Pick something to look forward to. An adult will confirm your choice.
        </p>
      </section>
      {success && (
        <div className="reward-success" role="status">
          <Check />
          <div>
            <h2>{success} is yours.</h2>
            <p>Your adult confirmed the reward. Enjoy it together.</p>
          </div>
          <button className="button secondary" onClick={() => setSuccess('')}>
            Done
          </button>
        </div>
      )}
      <div className="reward-grid">
        {data.rewards.map((r) => (
          <article className="panel reward-card" key={r.id}>
            <span className="reward-art">
              <Gift />
            </span>
            <span className="reward-cost">{r.pointCost} points</span>
            <h2>{r.name}</h2>
            <p>{r.description}</p>
            <button
              className={`button full ${data.points >= r.pointCost ? 'primary' : 'secondary'}`}
              disabled={data.points < r.pointCost || !!error}
              onClick={() => {
                if (
                  (data.soundEnabled || deviceSoundsEnabled()) &&
                  data.feedbackStyle !== 'OFF'
                )
                  void prepareCompletionSound();
                setSelected({ reward: r, requestId: crypto.randomUUID() });
              }}
            >
              {data.points >= r.pointCost
                ? 'Choose reward'
                : `${r.pointCost - data.points} more points to go`}
            </button>
          </article>
        ))}
      </div>
      {!data.rewards.length && (
        <div className="panel empty">
          <Gift />
          <h2>Your rewards are on their way.</h2>
          <p>Ask an adult to add something you’d enjoy.</p>
        </div>
      )}
      {selected && (
        <PinDialog
          title={`Confirm ${selected.reward.name}`}
          onCancel={() => setSelected(null)}
          onDone={async () => {
            try {
              const result = await api<{ alreadyRecorded: boolean }>(
                '/admin/redeem',
                'POST',
                {
                  userId: id,
                  rewardId: selected.reward.id,
                  requestId: selected.requestId,
                },
              );
              if (
                !result.alreadyRecorded &&
                (data.soundEnabled || deviceSoundsEnabled()) &&
                data.feedbackStyle !== 'OFF'
              )
                playCompletionSound(true);
              setSuccess(selected.reward.name);
              setSelected(null);
              await refresh();
            } finally {
              await api('/auth/logout', 'POST');
            }
          }}
        />
      )}
    </main>
  );
}
