import { Check, Gift, Sparkles, Star } from 'lucide-react';
import type { CompletionFeedback, Profile } from '@family/shared';
import { Avatar } from './Avatar';
export function feedbackStyle(profile: Profile) {
  return profile.feedbackStyle === 'AUTO'
    ? profile.role === 'CHILD'
      ? 'PLAYFUL'
      : 'QUIET'
    : profile.feedbackStyle;
}
export function Completion({
  profile,
  feedback,
  points,
  next,
  onContinue,
}: {
  profile: Profile;
  feedback: CompletionFeedback;
  points: number;
  next: boolean;
  onContinue: () => void;
}) {
  const style = feedbackStyle(profile);
  const playful = style === 'PLAYFUL';
  const enabled = style !== 'OFF';
  const fullDay = feedback.dayComplete;
  const period =
    feedback.periodComplete && feedback.periodComplete !== 'EXACT_TIME'
      ? `${feedback.periodComplete[0]}${feedback.periodComplete.slice(1).toLowerCase()} complete!`
      : null;
  const reward = feedback.nextReward;
  const remaining = reward
    ? Math.max(0, reward.pointCost - feedback.balance)
    : 0;
  return (
    <main
      className={`success-screen completion ${playful ? 'playful' : 'quiet'} ${fullDay ? 'day-complete' : ''}`}
    >
      {playful && (
        <div
          className={`celebration-particles ${fullDay ? 'confetti' : 'sparkles'}`}
          aria-hidden="true"
        >
          {Array.from({ length: fullDay ? 24 : 8 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--particle': i,
                  '--x': `${(i * 37) % 100}%`,
                  '--delay': `${(i % 6) * 0.08}s`,
                  '--color': ['#8b6bd0', '#69bea0', '#f6c65b', '#ee91b2'][
                    i % 4
                  ],
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="completion-avatar">
        <Avatar name={profile.avatar} large />
        <span className="completion-tick">
          <Check size={24} />
        </span>
      </div>
      <div role="status" aria-live="polite" className="completion-message">
        <p className="eyebrow">
          {enabled
            ? fullDay
              ? 'DAILY ROUTINE COMPLETE'
              : 'MEDICINE COMPLETE'
            : 'MEDICINE RECORDED'}
        </p>
        <h1>
          {!enabled
            ? 'Recorded as taken.'
            : fullDay
              ? 'All done for today!'
              : `Nice work, ${profile.displayName}!`}
        </h1>
        {enabled && (
          <p>
            {fullDay
              ? `Every medicine for today is recorded, ${profile.displayName}.`
              : (period ?? 'One more small step taken.')}
          </p>
        )}
        {enabled && (
          <div className="earned">
            <Sparkles aria-hidden="true" />+{points} points
          </div>
        )}
      </div>
      {enabled && (
        <>
          <div className="award-breakdown" aria-label="Points earned">
            <span>+{feedback.medicationPoints} medicine</span>
            {feedback.dailyPoints > 0 && (
              <span>+{feedback.dailyPoints} daily bonus</span>
            )}
            {feedback.streakPoints > 0 && (
              <span>+{feedback.streakPoints} streak bonus</span>
            )}
          </div>
          {fullDay && (
            <div className="daily-medal">
              <Star size={20} fill="currentColor" />
              Daily goal complete
            </div>
          )}
          <div className="completion-balance">
            <span>Your points</span>
            <strong>{feedback.balance}</strong>
          </div>
          {reward && (
            <div className="reward-progress">
              <p>
                <Gift size={18} />
                {remaining
                  ? `${remaining} more points until ${reward.name}`
                  : `${reward.name} is ready to redeem with an adult`}
              </p>
              <div
                role="progressbar"
                aria-label={`Progress toward ${reward.name}`}
                aria-valuemin={0}
                aria-valuemax={reward.pointCost}
                aria-valuenow={Math.min(reward.pointCost, feedback.balance)}
              >
                <span
                  style={{
                    width: `${Math.min(100, (feedback.balance / Math.max(1, reward.pointCost)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
      <button className="button primary" onClick={onContinue}>
        {next ? 'Next medicine' : 'Back home'}
      </button>
    </main>
  );
}
