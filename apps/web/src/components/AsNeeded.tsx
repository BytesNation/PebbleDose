import { useEffect, useRef, useState } from 'react';
import { Check, Pill, X } from 'lucide-react';
import type { AsNeededMedication } from '@family/shared';
import { api, refresh } from '../api';
import { PinDialog } from './PinDialog';
function RecordUse({
  medication,
  timezone,
  onClose,
}: {
  medication: AsNeededMedication;
  timezone: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(medication.doseDisplay);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [parent, setParent] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const record = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/as-needed/${medication.id}/uses`, 'POST', {
        requestId,
        doseDisplay: amount,
      });
      setSaved(true);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <dialog
        ref={dialog}
        className="pin-dialog"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) onClose();
        }}
      >
        <button
          type="button"
          className="icon-button close-dialog"
          aria-label="Close use record"
          disabled={busy}
          onClick={onClose}
        >
          <X />
        </button>
        {saved ? (
          <>
            <Check className="dialog-symbol" />
            <h2>Use recorded</h2>
            <p>
              {medication.displayName} · {amount}
            </p>
            <button className="button primary full" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <h2>Record as-needed use</h2>
            <p>{medication.displayName}</p>
            <p>{medication.instructions}</p>
            {medication.lastUsedAt && (
              <p>
                Last recorded:{' '}
                {new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: timezone,
                }).format(new Date(medication.lastUsedAt))}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (medication.requiresSupervision) setParent(true);
                else void record();
              }}
            >
              <label>
                Amount used
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  maxLength={100}
                  disabled={busy}
                />
              </label>
              <p>
                Record after use, following the prescribed instructions. This
                records use now; it does not advise when another dose is safe.
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary full" disabled={busy}>
                {busy
                  ? 'Recording…'
                  : medication.requiresSupervision
                    ? 'Adult: confirm use'
                    : 'Record use now'}
              </button>
            </form>
          </>
        )}
      </dialog>
      {parent && (
        <PinDialog
          onCancel={() => setParent(false)}
          onDone={async () => {
            try {
              await record();
              setParent(false);
            } finally {
              await api('/auth/logout', 'POST');
              await refresh();
            }
          }}
        />
      )}
    </>
  );
}
export function AsNeeded({
  medications,
  timezone,
}: {
  medications: AsNeededMedication[];
  timezone: string;
}) {
  const [selected, setSelected] = useState<AsNeededMedication | null>(null);
  if (!medications.length) return null;
  return (
    <section className="as-needed" aria-label="As-needed medications">
      <h2>As needed</h2>
      <p className="page-note">
        Use only according to the prescribed instructions. These medicines are
        separate from your daily routine.
      </p>
      <div className="history-tiles">
        {medications.map((m) => (
          <article className="panel as-needed-card" key={m.id}>
            <Pill />
            <h3>{m.displayName}</h3>
            <p>{m.doseDisplay}</p>
            <p>{m.instructions}</p>
            <small>
              {m.lastUsedAt
                ? `Last recorded ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(m.lastUsedAt))}`
                : 'No use recorded yet'}
            </small>
            <button className="button secondary" onClick={() => setSelected(m)}>
              Record use
            </button>
          </article>
        ))}
      </div>
      {selected && (
        <RecordUse
          medication={selected}
          timezone={timezone}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
