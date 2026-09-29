import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  adminApi,
  FACILITY_ROLES,
  ROLE_LABELS,
  ROLES,
  type Role,
  type User,
} from '../api/admin';
import { useSession } from '../auth/session-context';
import {
  Dialog,
  Notice,
  StatusBadge,
  TemporaryPasswordDialog,
} from '../components/ui';
import { errorMessage } from '../components/messages';

const PAGE_SIZE = 25;

/** All accounts: search, role filter and paging (server-side, for large numbers). */
export function UsersPage() {
  const navigate = useNavigate();
  // Set by the account page after a deletion.
  const deleted = (useLocation().state as { deleted?: string } | null)?.deleted;
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [page, setPage] = useState(1);
  const users = useQuery({
    queryKey: ['users', search, role, page],
    queryFn: () =>
      adminApi.users({
        q: search,
        role: role || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
  });
  const pages = users.data
    ? Math.max(1, Math.ceil(users.data.total / PAGE_SIZE))
    : 1;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="lead">
            Everyone who can sign in. Open an account to change its roles,
            facility or status.
          </p>
        </div>
        <Link className="button primary" to="/users/new">
          Add staff user
        </Link>
      </div>
      <form
        className="toolbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
      >
        <label className="sr-only" htmlFor="user-search">
          Search by name or email
        </label>
        <input
          id="user-search"
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value as Role | '');
          }}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button className="secondary" type="submit">
          Search
        </button>
      </form>
      {deleted && (
        <Notice kind="success">The account {deleted} was deleted.</Notice>
      )}
      {users.isError && (
        <Notice kind="error">{errorMessage(users.error)}</Notice>
      )}
      {users.isPending ? (
        <p className="muted">Loading…</p>
      ) : users.data && users.data.items.length === 0 ? (
        <div className="card">
          <p className="card-title">No users found</p>
          <p className="muted">Try another name, email or role.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.items.map((u) => (
              <tr
                key={u.id}
                className="clickable"
                tabIndex={0}
                onClick={() => navigate(`/users/${u.id}`)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && navigate(`/users/${u.id}`)
                }
              >
                <td data-label="Name">
                  <strong>{u.displayName}</strong>
                </td>
                <td data-label="Email">{u.email}</td>
                <td data-label="Roles">
                  {u.roles.map((r) => ROLE_LABELS[r]).join(', ')}
                </td>
                <td data-label="Status">
                  <StatusBadge status={u.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {users.data && users.data.total > PAGE_SIZE && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="muted">
            Page <span className="num">{page}</span> of{' '}
            <span className="num">{pages}</span> ·{' '}
            <span className="num">{users.data.total}</span> accounts
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

export function UserDetailPage() {
  const { id = '' } = useParams();
  const user = useQuery({
    queryKey: ['user', id],
    queryFn: () => adminApi.user(id),
  });
  if (user.isError)
    return <Notice kind="error">{errorMessage(user.error)}</Notice>;
  if (!user.data) return <p className="muted">Loading…</p>;
  // Keyed by id so a refetch after saving keeps the confirmation message.
  return <UserForm key={user.data.id} user={user.data} />;
}

function UserForm({ user }: { user: User }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { session } = useSession();
  const isSelf = session.status === 'signedIn' && session.user.id === user.id;
  const facilities = useQuery({
    queryKey: ['facilities'],
    queryFn: adminApi.facilities,
  });
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const [facilityId, setFacilityId] = useState(user.facilityId ?? '');
  const [active, setActive] = useState(user.status !== 'DISABLED');
  const [message, setMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const [temp, setTemp] = useState<string | null>(null);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['user', user.id] });
    void client.invalidateQueries({ queryKey: ['users'] });
  };
  const save = useMutation({
    mutationFn: () => {
      const sameRoles =
        roles.length === user.roles.length &&
        roles.every((r) => user.roles.includes(r));
      return adminApi.updateUser(user.id, {
        ...(sameRoles ? {} : { roles: [...roles].sort() }),
        ...(facilityId && facilityId !== user.facilityId ? { facilityId } : {}),
        ...(active !== (user.status !== 'DISABLED')
          ? { status: active ? 'ACTIVE' : 'DISABLED' }
          : {}),
      });
    },
    onSuccess: () => {
      setMessage({
        kind: 'success',
        text: 'Saved. Changes to access apply straight away.',
      });
      refresh();
    },
    onError: (e) => setMessage({ kind: 'error', text: errorMessage(e) }),
  });
  const unlock = useMutation({
    mutationFn: () => adminApi.updateUser(user.id, { unlock: true }),
    onSuccess: () => {
      setMessage({ kind: 'success', text: 'Account unlocked.' });
      refresh();
    },
    onError: (e) => setMessage({ kind: 'error', text: errorMessage(e) }),
  });
  const reset = useMutation({
    mutationFn: () => adminApi.resetPassword(user.id),
    onSuccess: (res) => {
      setTemp(res.temporaryPassword);
      refresh();
    },
    onError: (e) => setMessage({ kind: 'error', text: errorMessage(e) }),
  });
  const remove = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id),
    onSuccess: () => {
      client.removeQueries({ queryKey: ['user', user.id] });
      void client.invalidateQueries({ queryKey: ['users'] });
      void navigate('/users', { state: { deleted: user.email } });
    },
    onError: (e) => {
      setConfirmDelete(false);
      setMessage({ kind: 'error', text: errorMessage(e) });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (roles.length === 0) {
      setMessage({ kind: 'error', text: 'Choose at least one role.' });
      return;
    }
    if (roles.some((r) => FACILITY_ROLES.includes(r)) && !facilityId) {
      setMessage({
        kind: 'error',
        text: 'Clinicians and pathologists need a facility.',
      });
      return;
    }
    save.mutate();
  }

  return (
    <>
      <Link className="back-link" to="/users">
        ← Users
      </Link>
      <div className="page-header">
        <div>
          <h1>{user.displayName}</h1>
          <p>
            {user.email}
            <br />
            <span className="muted">
              {user.lastLoginAt
                ? `Last sign-in ${new Date(user.lastLoginAt).toLocaleString()}`
                : 'Never signed in'}
              {user.mustChangePassword
                ? ' · must choose a new password at next sign-in'
                : ''}
            </span>
          </p>
        </div>
        <StatusBadge status={user.status} />
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <form onSubmit={submit}>
        <div className="grid-2">
          <fieldset className="card fieldset">
            <legend className="card-title">Roles</legend>
            <p className="muted">What this person may do.</p>
            {ROLES.map((r) => (
              <label key={r} className="checkbox">
                <input
                  type="checkbox"
                  checked={roles.includes(r)}
                  onChange={(e) =>
                    setRoles((cur) =>
                      e.target.checked
                        ? [...cur, r]
                        : cur.filter((x) => x !== r),
                    )
                  }
                />
                <span>{ROLE_LABELS[r]}</span>
              </label>
            ))}
          </fieldset>
          <div className="card">
            <p className="card-title">Access</p>
            <p className="muted">
              Where they work and whether they can sign in.
            </p>
            <div className="field">
              <label htmlFor="facility">Facility</label>
              <select
                id="facility"
                aria-describedby="facility-hint"
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
              >
                <option value="">No facility</option>
                {facilities.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <span id="facility-hint" className="hint">
                Clinicians and pathologists only see patients of their own
                facility.
              </span>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={active}
                disabled={isSelf}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span>
                Account active
                <span className="hint">
                  {isSelf
                    ? 'You cannot switch off your own account.'
                    : 'Turning this off signs the person out everywhere.'}
                </span>
              </span>
            </label>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: '1rem' }}>
          <button className="primary" type="submit" disabled={save.isPending}>
            Save changes
          </button>
        </div>
      </form>
      {(user.status === 'LOCKED' || !isSelf) && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <p className="card-title">Account actions</p>
          <p className="muted">
            A reset gives a one-time password and signs the person out
            everywhere. Delete removes an account that has no clinical history;
            other accounts can be switched off with Account active.
          </p>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            {user.status === 'LOCKED' && (
              <button
                onClick={() => unlock.mutate()}
                disabled={unlock.isPending}
              >
                Unlock account
              </button>
            )}
            {!isSelf && (
              <button
                className="danger"
                onClick={() => reset.mutate()}
                disabled={reset.isPending}
              >
                Reset password
              </button>
            )}
            {!isSelf && (
              <button
                className="danger"
                onClick={() => setConfirmDelete(true)}
                disabled={remove.isPending}
              >
                Delete account
              </button>
            )}
          </div>
        </div>
      )}
      {confirmDelete && (
        <Dialog
          title="Delete this account?"
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button
                className="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? 'Deleting…' : 'Delete account'}
              </button>
            </>
          }
        >
          <p>
            <strong>{user.email}</strong> will be deleted with their roles,
            sessions, messages and assistant chats. This cannot be undone. A
            linked patient record stays; only the sign-in goes.
          </p>
          <p className="muted">
            Accounts that registered patients, recorded screenings or consents,
            uploaded scans or asked for AI analyses cannot be deleted, so the
            medical history stays traceable. Switch those off instead.
          </p>
        </Dialog>
      )}
      {temp && (
        <TemporaryPasswordDialog
          email={user.email}
          password={temp}
          onClose={() => setTemp(null)}
        />
      )}
    </>
  );
}

export function CreateUserPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const facilities = useQuery({
    queryKey: ['facilities'],
    queryFn: adminApi.facilities,
  });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<Role[]>(['CLINICIAN']);
  const [facilityId, setFacilityId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const create = useMutation({
    mutationFn: () =>
      adminApi.createUser({
        email: email.trim(),
        displayName: name.trim(),
        roles,
        facilityId: facilityId || undefined,
      }),
    onSuccess: (res) => {
      void client.invalidateQueries({ queryKey: ['users'] });
      setCreated({ email: res.user.email, password: res.temporaryPassword });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return setError('Enter a valid email address.');
    if (!name.trim()) return setError('Enter the full name.');
    if (roles.length === 0) return setError('Choose at least one role.');
    if (roles.some((r) => FACILITY_ROLES.includes(r)) && !facilityId)
      return setError('Clinicians and pathologists need a facility.');
    create.mutate();
  }

  return (
    <>
      <Link className="back-link" to="/users">
        ← Users
      </Link>
      <div className="page-header">
        <div>
          <h1>Add staff user</h1>
          <p className="lead">
            Patients create their own accounts in the mobile app.
          </p>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <form className="card" onSubmit={submit} noValidate>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="new-email">Email</label>
            <input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-name">Full name</label>
            <input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <fieldset className="fieldset field">
          <legend className="card-title">Roles</legend>
          {ROLES.filter((r) => r !== 'PATIENT').map((r) => (
            <label key={r} className="checkbox">
              <input
                type="checkbox"
                checked={roles.includes(r)}
                onChange={(e) =>
                  setRoles((cur) =>
                    e.target.checked ? [...cur, r] : cur.filter((x) => x !== r),
                  )
                }
              />
              <span>{ROLE_LABELS[r]}</span>
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor="new-facility">Facility</label>
          <select
            id="new-facility"
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
          >
            <option value="">No facility</option>
            {facilities.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <button className="primary" type="submit" disabled={create.isPending}>
          Create account
        </button>
      </form>
      {created && (
        <TemporaryPasswordDialog
          email={created.email}
          password={created.password}
          onClose={() => navigate('/users')}
        />
      )}
    </>
  );
}
