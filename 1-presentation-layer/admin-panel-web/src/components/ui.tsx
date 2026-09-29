import { useEffect, useRef, type ReactNode } from 'react';
import { useConnection } from './online';

/** A thin line from blue to the awareness light blue; decorative only. */
export function AccentLine() {
  return <div className="accent-line" aria-hidden="true" />;
}

/** Product mark and name; "Admin" says which surface this is. */
export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        PCa
      </span>
      <span className="brand-name">
        <span className="brand-long">PCa mHealth </span>Admin
        {subtitle && <small>{subtitle}</small>}
      </span>
    </span>
  );
}

/**
 * Sticky connection banner. The portal keeps nothing on the device, so while
 * offline it says plainly that changes cannot be saved.
 */
export function ConnectionBanner() {
  const { online, justReconnected } = useConnection();
  if (!online) {
    return (
      <div className="connection-banner offline" role="status">
        You are offline. Changes cannot be saved until the connection returns.
      </div>
    );
  }
  if (justReconnected) {
    return (
      <div className="connection-banner online" role="status">
        Back online.
      </div>
    );
  }
  return null;
}

export function Notice({
  kind,
  children,
}: {
  kind: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
}) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label =
    status === 'ACTIVE'
      ? 'Active'
      : status === 'LOCKED'
        ? 'Locked'
        : 'Disabled';
  return <span className={`badge ${status}`}>{label}</span>;
}

/** Accessible modal: focus moves inside, Escape closes. */
export function Dialog({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        {children}
        <div className="actions">{actions}</div>
      </div>
    </div>
  );
}

/** Shows a one-time password so it can be passed on privately. */
export function TemporaryPasswordDialog({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="Temporary password"
      onClose={onClose}
      actions={
        <>
          <button onClick={() => void navigator.clipboard?.writeText(password)}>
            Copy
          </button>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <p>
        For <strong>{email}</strong>. It is shown only once.
      </p>
      <p className="mono secret-box" data-testid="temp-password">
        {password}
      </p>
      <p className="muted">
        Give it to the person privately (not by group chat or email). They must
        choose their own password when they sign in.
      </p>
    </Dialog>
  );
}
