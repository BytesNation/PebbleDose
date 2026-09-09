import { BrandMark } from '../components/BrandMark';
import { Select } from '../components/Select';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api, refresh } from '../api';
export function Setup({ defaultTimezone }: { defaultTimezone: string }) {
  const navigate = useNavigate();
  const [name, setName] = useState(''),
    [adult, setAdult] = useState(''),
    [timezone, setTimezone] = useState(defaultTimezone),
    [pin, setPin] = useState(''),
    [repeat, setRepeat] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit() {
    setError('');
    if (pin !== repeat) {
      setError('The PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ adultId: string }>('/setup', 'POST', {
        name,
        timezone,
        adult: {
          name: adult,
          displayName: adult,
          role: 'ADULT',
          pin,
          avatar: 'sun',
        },
      });
      await api('/auth/login', 'POST', { userId: result.adultId, pin });
      await refresh();
      navigate('/admin/users?setup=1');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="setup-shell">
      <section className="setup-intro">
        <div className="brand">
          <BrandMark />
          <strong>PebbleDose</strong>
        </div>
        <p className="eyebrow">WELCOME TO FAMILY MEDICINE</p>
        <h1>
          A simple routine.
          <br />A little more
          <br />
          peace of mind.
        </h1>
        <p>
          Medicine reminders, family check-ins, and small rewards. All kept on
          your household server.
        </p>
        <span className="privacy-note">
          <ShieldCheck />
          No cloud account needed.
        </span>
      </section>
      <section className="setup-form">
        <p className="eyebrow">LET’S GET YOU SETTLED</p>
        <h2>Create your household</h2>
        <p>
          Start with an adult account. You’ll add your family and their routines
          next.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label>
            Household name
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Our family"
            />
          </label>
          <label>
            Your name
            <input
              required
              maxLength={100}
              value={adult}
              onChange={(e) => setAdult(e.target.value)}
              placeholder="Adult’s name"
            />
          </label>
          <label>
            Household timezone
            <Select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {[
                ...new Set([
                  timezone,
                  'UTC',
                  ...Intl.supportedValuesOf('timeZone'),
                ]),
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </label>
          <div className="form-grid">
            <label>
              Adult PIN
              <input
                required
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,12}"
                minLength={4}
                maxLength={12}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              Repeat PIN
              <input
                required
                type="password"
                inputMode="numeric"
                minLength={4}
                maxLength={12}
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>
          <small>Use 4 to 12 digits. This protects parent controls.</small>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? 'Creating…' : 'Create household'}
            <ArrowRight />
          </button>
        </form>
      </section>
    </main>
  );
}
