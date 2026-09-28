import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi, type AuditEntry, type AuditFilters } from '../api/admin';
import { Notice } from '../components/ui';
import { errorMessage } from '../components/messages';

const OUTCOME_LABELS: Record<AuditEntry['outcome'], string> = {
  SUCCESS: 'Done',
  DENIED: 'Refused',
  FAILURE: 'Failed',
};

/** Badge colours reuse the account-status styles (green, amber, red). */
const OUTCOME_BADGE: Record<AuditEntry['outcome'], string> = {
  SUCCESS: 'ACTIVE',
  DENIED: 'LOCKED',
  FAILURE: 'DISABLED',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

/**
 * The audit log, read-only (UC-09, FR-10): who did what, when, and whether it
 * was allowed. The check proves nothing was changed or removed. Reading the
 * log is itself recorded.
 */
export function AuditLogPage() {
  const [draft, setDraft] = useState<AuditFilters>({});
  const [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const logs = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: () => adminApi.auditLogs(filters, page),
    placeholderData: (previous) => previous,
  });
  const verify = useMutation({ mutationFn: adminApi.verifyAuditLog });
  const total = logs.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setFilters({
      ...(draft.action?.trim() ? { action: draft.action.trim() } : {}),
      ...(draft.outcome ? { outcome: draft.outcome } : {}),
      ...(draft.from ? { from: new Date(draft.from).toISOString() } : {}),
      ...(draft.to ? { to: new Date(draft.to).toISOString() } : {}),
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Audit log</h1>
          <p className="lead">
            Every sign-in, change, export and refusal, newest first. Entries
            cannot be changed or deleted; the check proves none were.
          </p>
        </div>
        <button
          className="primary"
          disabled={verify.isPending}
          onClick={() => verify.mutate()}
        >
          {verify.isPending ? 'Checking…' : 'Check integrity'}
        </button>
      </div>

      {verify.data &&
        (verify.data.intact ? (
          <Notice kind="success">
            Intact: all {verify.data.entries} entries are linked and unchanged.
          </Notice>
        ) : (
          <Notice kind="error">
            Broken at entry {verify.data.brokenAt}: {verify.data.reason}. Report
            this to the security lead.
          </Notice>
        ))}
      {verify.isError && (
        <Notice kind="error">{errorMessage(verify.error)}</Notice>
      )}

      <form className="toolbar" onSubmit={apply} aria-label="Filter the log">
        <label className="sr-only" htmlFor="audit-action">
          Action starts with
        </label>
        <input
          id="audit-action"
          placeholder="Action, e.g. fhir. or auth.login"
          value={draft.action ?? ''}
          onChange={(e) => setDraft({ ...draft, action: e.target.value })}
        />
        <label className="sr-only" htmlFor="audit-outcome">
          Outcome
        </label>
        <select
          id="audit-outcome"
          value={draft.outcome ?? ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              outcome: (e.target.value || undefined) as AuditFilters['outcome'],
            })
          }
        >
          <option value="">All outcomes</option>
          <option value="SUCCESS">Done</option>
          <option value="DENIED">Refused</option>
          <option value="FAILURE">Failed</option>
        </select>
        <label className="sr-only" htmlFor="audit-from">
          From
        </label>
        <input
          id="audit-from"
          type="date"
          value={draft.from ?? ''}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
        <label className="sr-only" htmlFor="audit-to">
          Until
        </label>
        <input
          id="audit-to"
          type="date"
          value={draft.to ?? ''}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
        <button type="submit">Filter</button>
      </form>

      {logs.isError && <Notice kind="error">{errorMessage(logs.error)}</Notice>}
      {logs.isPending ? (
        <p className="muted">Loading…</p>
      ) : logs.data?.items.length === 0 ? (
        <div className="card">
          <p className="card-title">No entries match.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {logs.data?.items.map((e) => (
              <tr key={e.seq}>
                <td data-label="When">
                  {when(e.occurredAt)}
                  <br />
                  <span className="muted mono">#{e.seq}</span>
                </td>
                <td data-label="Who">
                  {e.actorEmail ?? (e.actorUserId ? 'Unknown account' : '—')}
                  {e.actorRole && (
                    <>
                      <br />
                      <span className="muted">{e.actorRole}</span>
                    </>
                  )}
                </td>
                <td data-label="What">
                  <span className="mono">{e.action}</span>
                  <br />
                  <span className="muted">
                    {e.entityType}
                    {e.entityId ? ` ${e.entityId}` : ''}
                  </span>
                  {e.details && (
                    <>
                      <br />
                      <button
                        className="link-button"
                        aria-expanded={open === e.seq}
                        onClick={() => setOpen(open === e.seq ? null : e.seq)}
                      >
                        {open === e.seq ? 'Hide details' : 'Details'}
                      </button>
                      {open === e.seq && (
                        <pre className="details">
                          {JSON.stringify(e.details, null, 2)}
                        </pre>
                      )}
                    </>
                  )}
                </td>
                <td data-label="Outcome">
                  <span className={`badge ${OUTCOME_BADGE[e.outcome]}`}>
                    {OUTCOME_LABELS[e.outcome]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {total > 50 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="muted">
            Page <span className="num">{page}</span> of{' '}
            <span className="num">{pages}</span>
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
