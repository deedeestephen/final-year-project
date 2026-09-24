import { useEffect, useRef, type ReactNode } from 'react';

/** Zambian flag colours; decorative only. */
export function NationalStripe() {
  return (
    <div className="stripe" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: 'error' | 'success' | 'info';
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
      <p>For {email}. It is shown only once.</p>
      <p
        className="mono"
        style={{ fontSize: '1.3rem' }}
        data-testid="temp-password"
      >
        {password}
      </p>
      <p className="muted">
        Give it to the person privately (not by group chat or email). They must
        choose their own password when they sign in.
      </p>
    </Dialog>
  );
}
