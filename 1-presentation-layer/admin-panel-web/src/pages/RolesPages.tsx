import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  adminApi,
  ROLE_LABELS,
  type Permission,
  type Role,
  type RoleInfo,
} from '../api/admin';
import { Dialog, Notice } from '../components/ui';
import { errorMessage } from '../components/messages';

const GROUPS: Record<string, string> = {
  patient: 'Patients',
  clinical: 'Screening records',
  consent: 'Consent',
  imaging: 'Imaging',
  histopathology: 'Histopathology',
  ai: 'AI analysis',
  report: 'Reports',
  chatbot: 'Education assistant',
  notification: 'Messages',
  sync: 'Offline sync',
  user: 'Accounts',
  role: 'Accounts',
  patient_account: 'Accounts',
  facility: 'Facilities',
  audit: 'Audit',
  fhir: 'Data exchange',
};

export function RolesPage() {
  const roles = useQuery({ queryKey: ['roles'], queryFn: adminApi.roles });
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Roles &amp; permissions</h1>
          <p className="lead">
            A role is a set of permissions. Changes apply to everyone with the
            role on their next request, and are recorded in the audit log.
          </p>
        </div>
      </div>
      {roles.isError && (
        <Notice kind="error">{errorMessage(roles.error)}</Notice>
      )}
      {roles.isPending && <p className="muted">Loading…</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Permissions</th>
            <th>Accounts</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {roles.data?.map((r) => (
            <tr key={r.name}>
              <td data-label="Role">
                <strong>{ROLE_LABELS[r.name]}</strong>
                <br />
                <span className="muted">{r.description}</span>
              </td>
              <td data-label="Permissions">
                <span className="num">{r.permissions.length}</span>{' '}
                {r.customised && (
                  <span className="badge neutral">Customised</span>
                )}
              </td>
              <td data-label="Accounts">
                <span className="num">{r.userCount}</span>
              </td>
              <td className="actions-cell">
                <Link
                  className="button"
                  to={`/roles/${r.name}`}
                  aria-label={`Edit ${ROLE_LABELS[r.name]}`}
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function RolePermissionsPage() {
  const { name = '' } = useParams();
  const roles = useQuery({ queryKey: ['roles'], queryFn: adminApi.roles });
  const catalogue = useQuery({
    queryKey: ['permissions'],
    queryFn: adminApi.permissions,
  });
  const role = roles.data?.find((r) => r.name === name);
  if (roles.isError || catalogue.isError)
    return (
      <Notice kind="error">
        {errorMessage(roles.error ?? catalogue.error)}
      </Notice>
    );
  if (!role || !catalogue.data) return <p>Loading…</p>;
  return (
    <PermissionEditor key={role.name} role={role} catalogue={catalogue.data} />
  );
}

function PermissionEditor({
  role,
  catalogue,
}: {
  role: RoleInfo;
  catalogue: Permission[];
}) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role.permissions),
  );
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const done = (text: string) => (updated: RoleInfo) => {
    client.setQueryData<RoleInfo[]>(['roles'], (old) =>
      old?.map((r) => (r.name === updated.name ? updated : r)),
    );
    setSelected(new Set(updated.permissions));
    setMessage({ kind: 'success', text });
  };
  const save = useMutation({
    mutationFn: () =>
      adminApi.setRolePermissions(role.name as Role, [...selected].sort()),
    onSuccess: done('Permissions saved.'),
    onError: (e) => setMessage({ kind: 'error', text: errorMessage(e) }),
  });
  const reset = useMutation({
    mutationFn: () => adminApi.resetRole(role.name as Role),
    onSuccess: done('Back to the default permissions.'),
    onError: (e) => setMessage({ kind: 'error', text: errorMessage(e) }),
  });

  const groups = new Map<string, Permission[]>();
  for (const p of catalogue) {
    const group = GROUPS[p.code.split(':')[0]] ?? 'Other';
    groups.set(group, [...(groups.get(group) ?? []), p]);
  }
  const lockReason = (code: string) =>
    role.required.includes(code)
      ? 'Always needed, so nobody is locked out'
      : role.notAllowed.includes(code)
        ? 'Not allowed for this role'
        : null;

  return (
    <>
      <Link className="back-link" to="/roles">
        ← Roles &amp; permissions
      </Link>
      <div className="page-header">
        <div>
          <h1>{ROLE_LABELS[role.name as Role]}</h1>
          <p className="lead">{role.description}</p>
        </div>
        <span className="muted">
          <span className="num">{selected.size}</span> of{' '}
          <span className="num">{catalogue.length}</span> permissions ·{' '}
          <span className="num">{role.userCount}</span> account
          {role.userCount === 1 ? '' : 's'}
        </span>
      </div>
      {role.name === 'PATIENT' && (
        <Notice kind="info">
          For safety, patients can only be given permissions about themselves.
        </Notice>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <div className="grid-2">
        {[...groups.entries()].map(([group, permissions]) => (
          <fieldset key={group} className="card fieldset">
            <legend className="card-title">{group}</legend>
            {permissions.map((p) => {
              const locked = lockReason(p.code);
              return (
                <label key={p.code} className="checkbox">
                  <input
                    type="checkbox"
                    checked={selected.has(p.code)}
                    disabled={locked !== null}
                    onChange={(e) =>
                      setSelected((cur) => {
                        const next = new Set(cur);
                        if (e.target.checked) next.add(p.code);
                        else next.delete(p.code);
                        return next;
                      })
                    }
                  />
                  <span>
                    {p.description}
                    <span className="hint">
                      <span className="mono">{p.code}</span>
                      {locked && (
                        <>
                          {' '}
                          · <strong>Locked:</strong> {locked}
                        </>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div className="toolbar" style={{ marginTop: '1.5rem' }}>
        <button
          className="primary"
          onClick={() => setConfirming(true)}
          disabled={save.isPending}
        >
          Save permissions
        </button>
        <button onClick={() => reset.mutate()} disabled={reset.isPending}>
          Reset to defaults
        </button>
      </div>
      {confirming && (
        <Dialog
          title="Change this role?"
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button onClick={() => setConfirming(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  setConfirming(false);
                  save.mutate();
                }}
              >
                Save
              </button>
            </>
          }
        >
          <p>
            This changes what {role.userCount} account
            {role.userCount === 1 ? '' : 's'} with the{' '}
            {ROLE_LABELS[role.name as Role]} role can do, straight away. The
            change is recorded in the audit log.
          </p>
        </Dialog>
      )}
    </>
  );
}
