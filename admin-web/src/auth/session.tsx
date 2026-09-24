import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  ApiError,
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from '../api/client';
import type { User } from '../api/admin';
import { SessionContext, type Session } from './session-context';

export const NOT_ADMIN =
  'This portal is for administrators. Clinicians and patients use the mobile app.';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'restoring' });

  /** Loads the profile and admits administrators only. */
  const admit = useCallback(async () => {
    const user = await api.get<User>('/users/me');
    if (!user.roles.includes('ADMIN')) {
      await api.post('/auth/logout').catch(() => undefined);
      setAccessToken(null);
      setSession({ status: 'signedOut', reason: NOT_ADMIN });
      return;
    }
    setSession({ status: 'signedIn', user });
  }, []);

  useEffect(() => {
    onSessionExpired(() =>
      setSession({
        status: 'signedOut',
        reason: 'Your session has ended. Please sign in again.',
      }),
    );
    // Restore a session from the HttpOnly refresh cookie, if there is one.
    refreshSession()
      .then((ok) => (ok ? admit() : setSession({ status: 'signedOut' })))
      .catch(() =>
        setSession({
          status: 'signedOut',
          reason: 'Cannot reach the server. Check your connection.',
        }),
      );
  }, [admit]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ accessToken: string }>('/auth/login', {
        email: email.trim(),
        password,
      });
      setAccessToken(res.accessToken);
      await admit();
    },
    [admit],
  );

  const changePassword = useCallback(async (current: string, next: string) => {
    await api.post('/auth/change-password', {
      currentPassword: current,
      newPassword: next,
    });
    setSession((s) =>
      s.status === 'signedIn'
        ? { status: 'signedIn', user: { ...s.user, mustChangePassword: false } }
        : s,
    );
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    } finally {
      setAccessToken(null);
      setSession({ status: 'signedOut' });
    }
  }, []);

  const value = useMemo(
    () => ({ session, signIn, changePassword, signOut }),
    [session, signIn, changePassword, signOut],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
