import { AsNeeded } from '../components/AsNeeded';
import { KioskHistory } from '../components/KioskHistory';
import { Completion, feedbackStyle } from '../components/Completion';
import {
  prepareCompletionSound,
  deviceSoundsEnabled,
  playCompletionSound,
} from '../components/completionSound';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Pill,
  Sparkles,
  Clock,
  ShieldCheck,
  Gift,
} from 'lucide-react';
import type { ProfileData, Action, DoseActionResult } from '@family/shared';
import { api, ApiError, refresh } from '../api';
import { Avatar } from '../components/Avatar';
import { Progress } from '../components/Status';
import { PinDialog } from '../components/PinDialog';
export function Profile() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { data, error, refetch } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api<ProfileData>(`/kiosk/profiles/${id}`),
  });
  const [confirm, setConfirm] = useState(false),
    [success, setSuccess] = useState<DoseActionResult | null>(null);
  const now = new Date().toISOString();
  const pending =
    data?.doses
      .filter(
        (d) =>
          ['DUE', 'SNOOZED', 'AWAITING_SUPERVISION'].includes(d.status) &&
          d.scheduledAt <= now &&
          (!d.snoozedUntil || d.snoozedUntil <= now),
      )
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) ?? [];
  const dose = pending[0];
  const action = useMutation({
    mutationFn: (kind: Action['action']) =>
      api<DoseActionResult>(`/doses/${dose?.id}/actions`, 'POST', {
        action: kind,
      }),
    onSuccess: async (result) => {
      if (
        result.status === 'TAKEN' &&
        !result.alreadyRecorded &&
        result.feedback
      ) {
        setSuccess(result);
        if (
          data &&
          (data.profile.soundEnabled || deviceSoundsEnabled()) &&
          feedbackStyle(data.profile) !== 'OFF'
        )
          playCompletionSound(result.feedback.dayComplete);
      }
      await refresh();
      if (result.status === 'AWAITING_SUPERVISION') setConfirm(true);
    },
  });
  useEffect(() => {
    if (!success || success.feedback?.dayComplete) return;
    const timer = setTimeout(() => {
      if (pending.length) setSuccess(null);
      else navigate('/kiosk');
    }, data?.returnDelay ?? 1800);
    return () => clearTimeout(timer);
  }, [success, navigate, pending.length, data?.returnDelay]);
  const prepareSound = () => {
    if (
      data &&
      (data.profile.soundEnabled || deviceSoundsEnabled()) &&
      feedbackStyle(data.profile) !== 'OFF'
    )
      prepareCompletionSound();
  };
  if (error instanceof ApiError && error.status === 401)
    return (
      <PinDialog
        profileId={id}
        title="Unlock your profile"
        onCancel={() => navigate('/kiosk')}
        onDone={async () => {
          await refetch();
        }}
      />
    );
  if (!data)
    return (
      <main className="loading" role="status">
        {error
          ? 'Your profile could not be loaded. Check the local connection.'
          : 'Opening your medicines…'}
        <Link to="/kiosk" className="button secondary">
          Back home
        </Link>
      </main>
    );
  if (success?.feedback)
    return (
      <Completion
        profile={data.profile}
        feedback={success.feedback}
        points={success.points}
        next={pending.length > 0}
        onContinue={() =>
          pending.length ? setSuccess(null) : navigate('/kiosk')
        }
      />
    );
  return (
    <main className="profile-shell">
      <header className="profile-header">
        <Link className="back-link" to="/kiosk">
          <ArrowLeft />
          Back home
        </Link>
        <span className="profile-identity">
          <Avatar name={data.profile.avatar} />
          {data.profile.displayName}
        </span>
        <Link className="points-link" to={`/kiosk/profile/${id}/rewards`}>
          <Gift />
          {data.profile.rewardPoints} points
        </Link>
      </header>
      <section className="medicine-layout">
        <aside className="today-card">
          <p className="eyebrow">YOUR DAY</p>
          <h2>
            A little care,
            <br />
            every day.
          </h2>
          <Progress
            complete={data.profile.complete}
            total={data.profile.total}
          />
          <div className="periods">
            {['MORNING', 'AFTERNOON', 'EVENING', 'EXACT_TIME']
              .filter((p) => data.doses.some((d) => d.period === p))
              .map((period) => {
                const rows = data.doses.filter((d) => d.period === period);
                return (
                  <div key={period}>
                    <span>
                      {rows.every((d) => d.status === 'TAKEN') ? (
                        <Check />
                      ) : (
                        <Clock />
                      )}
                      {period === 'EXACT_TIME'
                        ? 'Scheduled'
                        : period.toLowerCase()}
                    </span>
                    <small>
                      {rows.filter((d) => d.status === 'TAKEN').length}/
                      {rows.length}
                    </small>
                  </div>
                );
              })}
          </div>
          <p className="support-text">
            <ShieldCheck />
            An adult set up this routine for you.
          </p>
        </aside>
        <section className="medicine-card">
          {dose ? (
            <>
              <p className="eyebrow">
                {dose.period.replace('_', ' ')} · {data.profile.complete + 1} OF{' '}
                {data.profile.total} TODAY
              </p>
              <div className="medicine-illustration">
                {dose.image ? (
                  <img src={dose.image} alt={dose.displayName} />
                ) : (
                  <Pill size={68} strokeWidth={1.3} />
                )}
              </div>
              <h1>{dose.displayName}</h1>
              <p className="dose-text">{dose.doseDisplay}</p>
              <p className="instructions">{dose.instructions}</p>
              <p className="earn-preview">
                <Sparkles size={16} />
                Earn {data.awardPoints} points
              </p>
              <div className="medicine-actions">
                {dose.status === 'AWAITING_SUPERVISION' ? (
                  <>
                    <p className="waiting">
                      <ShieldCheck />
                      Waiting for parent confirmation
                    </p>
                    <button
                      className="button primary hero-button"
                      onClick={() => setConfirm(true)}
                    >
                      Parent: confirm medicine
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="button primary hero-button"
                      disabled={action.isPending || !!error}
                      onClick={() => {
                        prepareSound();
                        action.mutate(
                          dose.requiresSupervision ? 'READY' : 'TAKE',
                        );
                      }}
                    >
                      {dose.requiresSupervision ? <ShieldCheck /> : <Check />}
                      {action.isPending
                        ? 'Saving…'
                        : dose.requiresSupervision
                          ? 'I’M READY'
                          : 'I TOOK IT'}
                    </button>
                    <button
                      className="button secondary full"
                      disabled={action.isPending || !!error}
                      onClick={() => action.mutate('SNOOZE')}
                    >
                      NOT RIGHT NOW <span>Remind me in 10 min</span>
                    </button>
                  </>
                )}
              </div>
              <p className="record-note">
                {dose.requiresSupervision
                  ? 'An adult will confirm with you.'
                  : 'Tap after taking your medicine.'}
              </p>
            </>
          ) : (
            <div className="all-done">
              <span className="success-check">
                <Check size={50} />
              </span>
              <h1>
                {data.profile.total === 0
                  ? 'No scheduled medicines today.'
                  : data.profile.complete === data.profile.total
                    ? 'You’re all done.'
                    : 'Nothing due right now.'}
              </h1>
              <p>
                {data.profile.nextAt
                  ? `Next reminder at ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: data.timezone }).format(new Date(data.profile.nextAt))}.`
                  : 'Your routine is up to date.'}
              </p>
              <Link to="/kiosk" className="button primary">
                Back home
              </Link>
            </div>
          )}
          {action.error && (
            <p className="error" role="alert">
              {action.error.message}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              Connection interrupted. Reconnect before recording a dose.
            </p>
          )}
        </section>
      </section>
      <AsNeeded medications={data.asNeeded} timezone={data.timezone} />
      <KioskHistory history={data.history} timezone={data.timezone} />
      {confirm && dose && (
        <PinDialog
          onCancel={() => setConfirm(false)}
          onDone={async () => {
            prepareSound();
            try {
              await action.mutateAsync('CONFIRM');
              setConfirm(false);
            } finally {
              await api('/auth/logout', 'POST');
              await refresh();
            }
          }}
        />
      )}
    </main>
  );
}
