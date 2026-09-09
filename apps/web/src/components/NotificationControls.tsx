import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, X } from 'lucide-react';
import { api } from '../api';
import {
  prepareCompletionSound,
  playCompletionSound,
  playReminderSound,
} from './completionSound';
function preference(key: string, fallback = false) {
  return localStorage.getItem(key) === null
    ? fallback
    : localStorage.getItem(key) === 'true';
}
export function NotificationControls() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState(() =>
    preference('pebbledose-alerts', true),
  );
  const [reminder, setReminder] = useState(() =>
    preference('pebbledose-reminder-sound'),
  );
  const [success, setSuccess] = useState(() =>
    preference('pebbledose-success-sound'),
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { data: pending = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api<{ id: string; kind: string }[]>('/alerts'),
  });
  const { data: config, refetch } = useQuery({
    queryKey: ['push-config'],
    queryFn: () =>
      api<{ publicKey: string; subscribed: boolean }>('/push/config'),
  });
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  useEffect(() => {
    if (!reminder) return;
    const unlock = () => {
      void prepareCompletionSound();
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, [reminder]);
  useEffect(() => {
    if (!alerts || !reminder || !pending.length) return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(
        localStorage.getItem('pebbledose-alerts-heard') || '[]',
      );
    } catch {
      /* Reset invalid preferences. */
    }
    if (pending.some((a) => !seen.includes(a.id))) {
      if (!playReminderSound()) return;
      localStorage.setItem(
        'pebbledose-alerts-heard',
        JSON.stringify(
          [...new Set([...seen, ...pending.map((a) => a.id)])].slice(-200),
        ),
      );
    }
  }, [pending, alerts, reminder]);
  function toggle(
    key: string,
    value: boolean,
    setter: (value: boolean) => void,
  ) {
    localStorage.setItem(key, String(value));
    setter(value);
    if (value) void prepareCompletionSound();
  }
  async function push(action: 'enable' | 'disable' | 'test') {
    setBusy(true);
    setMessage('');
    try {
      if (action === 'test') {
        await api('/push/test', 'POST');
        setMessage('Test sent. Check this device’s notifications.');
        return;
      }
      if (action === 'disable') {
        await api('/push/unsubscribe', 'POST');
        const registration = await navigator.serviceWorker?.getRegistration();
        await (
          await registration?.pushManager.getSubscription()
        )?.unsubscribe();
        await refetch();
        setMessage('Background notifications are off.');
        return;
      }
      if (
        !window.isSecureContext ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      )
        throw new Error(
          'Background notifications need a supported browser and HTTPS (or localhost). On iPhone or iPad, install PebbleDose on your Home Screen first.',
        );
      const permission = await Notification.requestPermission();
      if (permission !== 'granted')
        throw new Error(
          'Notifications are not allowed. You can change this in your browser’s site settings.',
        );
      const registration = await navigator.serviceWorker.register('/sw.js');
      await registration.update();
      const worker = registration.installing || registration.waiting;
      if (worker)
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(
            () =>
              reject(
                new Error('Notification setup timed out. Please try again.'),
              ),
            15000,
          );
          const check = () => {
            if (worker.state === 'installed')
              worker.postMessage({ type: 'ACTIVATE_UPDATE' });
            if (worker.state === 'activated') {
              clearTimeout(timeout);
              resolve();
            }
            if (worker.state === 'redundant') {
              clearTimeout(timeout);
              reject(
                new Error('Notification update failed. Please try again.'),
              );
            }
          };
          worker.addEventListener('statechange', check);
          check();
        });
      const current = await api<{ publicKey: string }>('/push/config');
      const key = Uint8Array.from(
        atob(current.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      );
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      await api('/push/subscribe', 'POST', subscription.toJSON());
      await refetch();
      setMessage('Background notifications are on for this device.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="icon-button"
        aria-label="Alerts and sounds"
        onClick={() => setOpen(true)}
      >
        <Bell size={22} />
      </button>
      {alerts && pending.length > 0 && (
        <div className="reminder-strip" role="status">
          <Bell size={18} />
          {pending.filter((a) => a.kind === 'overdue').length} overdue ·{' '}
          {pending.filter((a) => a.kind === 'due').length} due ·{' '}
          {pending.filter((a) => a.kind === 'confirmation').length} awaiting an
          adult
        </div>
      )}
      {open && (
        <dialog
          ref={dialog}
          className="pin-dialog notification-dialog"
          onCancel={() => setOpen(false)}
          aria-labelledby="notification-title"
        >
          <button
            className="icon-button close-dialog"
            aria-label="Close alerts and sounds"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
          <h2 id="notification-title">Alerts & sounds</h2>
          <p>Choose what this device plays and receives.</p>
          <label>
            <input
              type="checkbox"
              checked={alerts}
              onChange={(e) =>
                toggle('pebbledose-alerts', e.target.checked, setAlerts)
              }
            />{' '}
            Show household alerts
          </label>
          <label>
            <input
              type="checkbox"
              checked={reminder}
              onChange={(e) =>
                toggle(
                  'pebbledose-reminder-sound',
                  e.target.checked,
                  setReminder,
                )
              }
            />{' '}
            Reminder chime while open
          </label>
          <label>
            <input
              type="checkbox"
              checked={success}
              onChange={(e) =>
                toggle('pebbledose-success-sound', e.target.checked, setSuccess)
              }
            />{' '}
            Medicine success & reward sounds
          </label>
          <p className="muted">
            Individual profile sound settings also apply. Celebrations set to
            Off stay quiet.
          </p>
          <div className="notification-actions">
            <button
              className="button secondary"
              onClick={async () => {
                await prepareCompletionSound();
                if (!playReminderSound()) return;
              }}
            >
              Try reminder
            </button>
            <button
              className="button secondary"
              onClick={async () => {
                await prepareCompletionSound();
                playCompletionSound(true);
              }}
            >
              Try celebration
            </button>
          </div>
          <h3>Background notifications</h3>
          <p>
            {config?.subscribed
              ? 'Enabled for this device'
              : 'Off for this device'}
          </p>
          <p className="muted">
            Needs Internet access and browser permission. Notification text
            excludes names and medication details. Your device controls
            background notification sounds.
          </p>
          <div className="notification-actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void push(config?.subscribed ? 'disable' : 'enable')
              }
            >
              {busy
                ? 'Please wait…'
                : config?.subscribed
                  ? 'Turn off notifications'
                  : 'Enable notifications'}
            </button>
            {config?.subscribed && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void push('test')}
              >
                Send test
              </button>
            )}
          </div>
          {message && <p role="status">{message}</p>}
        </dialog>
      )}
    </>
  );
}
