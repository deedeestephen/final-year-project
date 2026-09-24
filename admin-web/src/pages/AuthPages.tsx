import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { useSession } from '../auth/session-context';
import { NationalStripe, Notice } from '../components/ui';
import { errorMessage, NOT_OFFICIAL } from '../components/messages';

function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <NationalStripe />
      <main className="auth-card">
        <h1>{title}</h1>
        {children}
        <p className="muted footer-note">{NOT_OFFICIAL}</p>
      </main>
    </div>
  );
}

const LOGIN_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  ACCOUNT_LOCKED:
    'This account is temporarily locked after too many attempts. Try again later.',
};

export function LoginPage() {
  const { session, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = session.status === 'signedOut' ? session.reason : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError && LOGIN_MESSAGES[err.code]
          ? LOGIN_MESSAGES[err.code]
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Admin sign in">
      <p>PCa mHealth administration portal.</p>
      {(error ?? reason) && <Notice kind="error">{error ?? reason}</Notice>}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}

export function ChangePasswordPage() {
  const { changePassword, signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 12) return setError('Use at least 12 characters.');
    if (next === current)
      return setError('Choose a password different from your current one.');
    if (next !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
    } catch (err) {
      const fields = err instanceof ApiError ? err.fieldErrors() : {};
      setError(
        fields.password?.join(' ') ??
          (err instanceof ApiError && err.code === 'INVALID_CURRENT_PASSWORD'
            ? 'Your current password is incorrect.'
            : errorMessage(err)),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Choose a new password">
      <p>For your security, set your own password before you continue.</p>
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="current">Current password</label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new">New password (12 or more characters)</label>
          <input
            id="new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="toolbar">
          <button className="primary" type="submit" disabled={busy}>
            Save password
          </button>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
