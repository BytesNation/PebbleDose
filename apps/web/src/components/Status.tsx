import type { Profile } from '@family/shared';
import { Check, Clock, AlertCircle } from 'lucide-react';
export function Status({ profile }: { profile: Profile }) {
  const text = profile.awaiting
    ? 'Parent needed'
    : profile.overdue
      ? `${profile.overdue} overdue`
      : profile.due
        ? `${profile.due} due now`
        : profile.complete === profile.total && profile.total
          ? 'All done'
          : profile.total
            ? 'Upcoming'
            : 'No medicines today';
  const Icon = profile.due
    ? AlertCircle
    : profile.complete === profile.total
      ? Check
      : Clock;
  return (
    <span
      className={`status ${profile.due ? 'attention' : profile.complete === profile.total ? 'done' : 'upcoming'}`}
    >
      <Icon size={18} aria-hidden="true" />
      {text}
    </span>
  );
}
export function Progress({
  complete,
  total,
}: {
  complete: number;
  total: number;
}) {
  return (
    <div className="daily-progress">
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Today's medicines complete"
        aria-valuenow={complete}
        aria-valuemin={0}
        aria-valuemax={Math.max(total, 1)}
      >
        <span style={{ width: `${total ? (complete / total) * 100 : 0}%` }} />
      </div>
      <span>
        {complete} of {total} complete
      </span>
    </div>
  );
}
