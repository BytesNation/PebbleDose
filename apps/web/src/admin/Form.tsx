import { useState, type ReactNode } from 'react';
import { api, refresh } from '../api';
export function Editor({
  title,
  children,
  onSave,
  onCancel,
  button = 'Save',
}: {
  title: string;
  children: ReactNode;
  onSave: (form: FormData) => Promise<void>;
  onCancel: () => void;
  button?: string;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="editor panel">
      <div className="section-title">
        <h2>{title}</h2>
        <button className="text-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          setBusy(true);
          setError('');
          void onSave(values)
            .then(() => refresh())
            .then(onCancel)
            .catch((e) => setError((e as Error).message))
            .finally(() => setBusy(false));
        }}
      >
        {children}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : button}
        </button>
      </form>
    </section>
  );
}
export function Field({
  name,
  label,
  value = '',
  type = 'text',
  required = true,
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={type === 'text' ? 100 : undefined}
        min={type === 'number' ? 0 : undefined}
      />
    </label>
  );
}
export function Toggle({
  name,
  label,
  checked = false,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" name={name} defaultChecked={checked} />
      <span>{label}</span>
    </label>
  );
}
export const str = (form: FormData, key: string) => String(form.get(key) ?? '');
export async function save(
  path: string,
  id: string | undefined,
  body: unknown,
) {
  await api(`${path}${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', body);
}
