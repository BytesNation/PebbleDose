import { Select } from './Select';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Delete, LockKeyhole, X } from 'lucide-react';
import { api } from '../api';
export function PinDialog({
  onDone,
  onCancel,
  profileId,
  title = 'Parent confirmation',
}: {
  onDone: () => Promise<void> | void;
  onCancel: () => void;
  profileId?: string;
  title?: string;
}) {
  const { data: adults = [] } = useQuery({
    queryKey: ['adults'],
    queryFn: () => api<{ id: string; displayName: string }[]>('/auth/adults'),
  });
  const [selected, setSelected] = useState(profileId ?? ''),
    [pin, setPin] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', 'POST', {
        userId: selected || adults[0]?.id,
        pin,
      });
      await onDone();
    } catch (e) {
      setError((e as Error).message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="pin-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="pin-title"
    >
      <button
        className="icon-button close-dialog"
        onClick={onCancel}
        aria-label="Close PIN entry"
      >
        <X />
      </button>
      <LockKeyhole className="dialog-symbol" />
      <h2 id="pin-title">{title}</h2>
      <p>Enter your PIN to continue.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {!profileId && (
          <label>
            Adult
            <Select
              value={selected || adults[0]?.id || ''}
              onChange={(e) => setSelected(e.target.value)}
            >
              {adults.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="sr-only" htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          autoFocus
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4,12}"
          maxLength={12}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="pin-input"
          aria-label="PIN"
        />
        <div className="pin-pad">
          {[
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
            'Clear',
            '0',
            'Backspace',
          ].map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              aria-label={n}
              onClick={() =>
                setPin((p) =>
                  n === 'Clear'
                    ? ''
                    : n === 'Backspace'
                      ? p.slice(0, -1)
                      : (p + n).slice(0, 12),
                )
              }
            >
              {n === 'Backspace' ? <Delete aria-hidden="true" /> : n}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="button primary full"
          disabled={busy || pin.length < 4}
        >
          {busy ? 'Checking…' : 'Confirm'}
        </button>
      </form>
    </dialog>
  );
}
