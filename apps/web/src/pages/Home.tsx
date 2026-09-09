import { NotificationControls } from '../components/NotificationControls';
import { BrandMark } from '../components/BrandMark';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Settings,
  ArrowUpRight,
  Sparkles,
  Star,
  ShieldCheck,
} from 'lucide-react';
import type { KioskData } from '@family/shared';
import { api, queryClient } from '../api';
import { Avatar } from '../components/Avatar';
import { InstallButton } from '../components/InstallButton';
import { Status, Progress } from '../components/Status';
export function Home() {
  const [locked, setLocked] = useState(false);
  const { data, error } = useQuery({
    queryKey: ['kiosk'],
    queryFn: async () => {
      await api('/kiosk/connect', 'POST');
      queryClient.removeQueries({
        predicate: (q) =>
          !['kiosk', 'setup', 'alerts', 'push-config'].includes(
            String(q.queryKey[0]),
          ),
      });
      setLocked(true);
      return api<KioskData>('/kiosk');
    },
  });
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!data || !locked)
    return (
      <main className="loading" role="status">
        {error
          ? 'Cannot reach your household server. Check its power and local connection.'
          : 'Opening your household…'}
      </main>
    );
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: data.household.timezone,
    }).format(clock),
  );
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const due = data.profiles.reduce((n, p) => n + p.due, 0);
  return (
    <main className="kiosk-shell">
      <header className="kiosk-header">
        <div className="brand">
          <BrandMark />
          PebbleDose
          <span className="brand-divider" />
          {data.household.name}
        </div>
        <NotificationControls />
        <Link className="icon-button" to="/admin" aria-label="Parent settings">
          <Settings size={22} />
        </Link>
      </header>
      <section className="greeting">
        <div>
          <p className="eyebrow">A LITTLE ROUTINE. A LITTLE PEACE OF MIND.</p>
          <h1>
            {greeting}
            <span className="greeting-dot">.</span>
          </h1>
          <p>Choose your name. Let’s take care of today.</p>
        </div>
        <div className="clock">
          <strong>
            {new Intl.DateTimeFormat('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: data.household.timezone,
            }).format(clock)}
          </strong>
          <span>
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              timeZone: data.household.timezone,
            }).format(clock)}
          </span>
        </div>
      </section>
      <section className="family-heading">
        <h2>Your family</h2>
        <span className="quiet-pill">
          {due
            ? `${due} ${due === 1 ? 'medicine' : 'medicines'} ready now`
            : 'Everyone is caught up'}
        </span>
      </section>
      <section className="profile-grid" aria-label="Family profiles">
        {data.profiles.map((p) => (
          <Link
            to={`/kiosk/profile/${p.id}`}
            key={p.id}
            className={`profile-card ${p.due ? 'has-due' : ''}`}
          >
            <div className="profile-top">
              <Avatar name={p.avatar} />
              <ArrowUpRight className="card-arrow" size={23} />
            </div>
            <h2>{p.displayName}</h2>
            <Status profile={p} />
            {p.total > 0 && p.complete === p.total && (
              <span className="home-completion-badge">
                <Star size={14} fill="currentColor" />
                Daily goal complete
              </span>
            )}
            <Progress complete={p.complete} total={p.total} />
            <div className="profile-bottom">
              <span>
                <Sparkles size={18} />
                <strong>{p.rewardPoints}</strong> points
              </span>
              <span>
                {p.nextAt && p.due === 0
                  ? `Next ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: data.household.timezone }).format(new Date(p.nextAt))}`
                  : 'View today'}
              </span>
            </div>
          </Link>
        ))}
      </section>
      <footer className="kiosk-footer">
        <InstallButton />
        <span>
          <ShieldCheck size={17} />
          Your family’s routine, kept at home.
        </span>
        <span>One small step at a time.</span>
      </footer>
      {error && (
        <div role="alert" className="connection-banner">
          Connection interrupted. Displayed status may be out of date.
        </div>
      )}
    </main>
  );
}
