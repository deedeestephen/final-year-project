import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi, type PatientAccount, type RecordMatch } from '../api/admin';
import { ApiError } from '../api/client';
import { Dialog, Notice } from '../components/ui';
import { errorMessage } from '../components/messages';

type Filter = 'unlinked' | 'linked' | 'all';

/**
 * Gives patients access to their own data: an account is linked to its clinic
 * record only by an exact NRC match, and the administrator sees just the
 * record number and facility, never clinical details.
 */
export function PatientAccountsPage() {
  const client = useQueryClient();
  const [filter, setFilter] = useState<Filter>('unlinked');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const [pending, setPending] = useState<{
    account: PatientAccount;
    match: RecordMatch;
  } | null>(null);
  const [unlinking, setUnlinking] = useState<PatientAccount | null>(null);
  const accounts = useQuery({
    queryKey: ['patient-accounts', filter, page],
    queryFn: () => adminApi.patientAccounts(filter, page),
    placeholderData: (previous) => previous,
  });
  const refresh = () =>
    void client.invalidateQueries({ queryKey: ['patient-accounts'] });

  const find = useMutation({
    mutationFn: (account: PatientAccount) =>
      adminApi.match(account.userId).then((match) => ({ account, match })),
    onSuccess: setPending,
    onError: (e) =>
      setMessage({
        kind: 'error',
        text:
          e instanceof ApiError && e.code === 'NO_MATCH'
            ? 'No clinic record has this NRC yet. The clinic must register the patient with the same NRC first.'
            : e instanceof ApiError && e.code === 'NO_NRC'
              ? 'This account uses a passport. The clinic links passport holders.'
              : errorMessage(e),
      }),
  });
  const link = useMutation({
    mutationFn: (userId: string) => adminApi.link(userId),
    onSuccess: () => {
      setMessage({
        kind: 'success',
        text: 'Account linked. The patient has been told.',
      });
      refresh();
    },
    onError: (e) => setMessage({ kind: 'error', text: errorMessage(e) }),
  });
  const unlink = useMutation({
    mutationFn: (userId: string) => adminApi.unlink(userId),
    onSuccess: () => {
      setMessage({ kind: 'success', text: 'Account unlinked.' });
      refresh();
    },
    onError: (e) => setMessage({ kind: 'error', text: errorMessage(e) }),
  });

  const total = accounts.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <>
      <h1>Patient accounts</h1>
      <p>
        Link a patient&apos;s app account to their clinic record so they can see
        their own results. Linking needs the same NRC on both.
      </p>
      <div className="toolbar" role="group" aria-label="Show">
        {(['unlinked', 'linked', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            className={filter === f ? 'primary' : ''}
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
          >
            {f === 'unlinked'
              ? 'Not linked'
              : f === 'linked'
                ? 'Linked'
                : 'All'}
          </button>
        ))}
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {accounts.isError && (
        <Notice kind="error">{errorMessage(accounts.error)}</Notice>
      )}
      {accounts.isPending ? (
        <p>Loading…</p>
      ) : accounts.data?.items.length === 0 ? (
        <p>No accounts here.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Identity</th>
              <th>Clinic record</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.data?.items.map((a) => (
              <tr key={a.userId}>
                <td data-label="Name">
                  {a.displayName}
                  <br />
                  <span className="muted">{a.email}</span>
                </td>
                <td data-label="Identity">
                  {a.idDocumentType
                    ? `${a.idDocumentType === 'NRC' ? 'NRC' : 'Passport'} ${a.idNumberMasked}`
                    : '—'}
                  {a.phoneMasked && (
                    <>
                      <br />
                      <span className="muted">Phone {a.phoneMasked}</span>
                    </>
                  )}
                </td>
                <td data-label="Clinic record">
                  {a.linked
                    ? `${a.linked.mrn} at ${a.linked.facilityName}`
                    : 'Not linked'}
                </td>
                <td>
                  {a.linked ? (
                    <button onClick={() => setUnlinking(a)}>Unlink</button>
                  ) : (
                    <button
                      className="primary"
                      disabled={find.isPending}
                      onClick={() => {
                        setMessage(null);
                        find.mutate(a);
                      }}
                    >
                      Find record and link
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {total > 50 && (
        <div
          className="toolbar"
          style={{ marginTop: '1rem', alignItems: 'center' }}
        >
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
      {pending && (
        <Dialog
          title={
            pending.match.linkedToAnotherAccount
              ? 'Already linked'
              : 'Link this account?'
          }
          onClose={() => setPending(null)}
          actions={
            <>
              <button onClick={() => setPending(null)}>Cancel</button>
              {!pending.match.linkedToAnotherAccount && (
                <button
                  className="primary"
                  onClick={() => {
                    link.mutate(pending.account.userId);
                    setPending(null);
                  }}
                >
                  Link
                </button>
              )}
            </>
          }
        >
          <p>
            {pending.match.linkedToAnotherAccount
              ? `Record ${pending.match.mrn} at ${pending.match.facilityName} is already linked to another account. Check with the clinic.`
              : `The NRC matches record ${pending.match.mrn} at ${pending.match.facilityName}. ${pending.account.displayName} will be able to see their own results and messages in the app.`}
          </p>
        </Dialog>
      )}
      {unlinking && (
        <Dialog
          title="Unlink this account?"
          onClose={() => setUnlinking(null)}
          actions={
            <>
              <button onClick={() => setUnlinking(null)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  unlink.mutate(unlinking.userId);
                  setUnlinking(null);
                }}
              >
                Unlink
              </button>
            </>
          }
        >
          <p>
            {unlinking.displayName} will no longer see record{' '}
            {unlinking.linked?.mrn} in the app and will be signed out.
          </p>
        </Dialog>
      )}
    </>
  );
}
