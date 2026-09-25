import { createContext, useContext } from 'react';
import type { User } from '../api/admin';

export type Session =
  | { status: 'restoring' }
  | { status: 'signedOut'; reason?: string }
  | { status: 'signedIn'; user: User };

export interface SessionApi {
  session: Session;
  signIn(email: string, password: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  signOut(): Promise<void>;
}

export const SessionContext = createContext<SessionApi | null>(null);

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
