import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminApi,
  FACILITY_ROLES,
  ROLE_LABELS,
  ROLES,
  type Role,
  type User,
} from '../api/admin';
import { useSession } from '../auth/session-context';
import { Notice, StatusBadge, TemporaryPasswordDialog } from '../components/ui';
import { errorMessage } from '../components/messages';

const PAGE_SIZE = 25;

/** All accounts: search, role filter and paging (server-side, for large numbers). */
export function UsersPage() {
  const navigate = useNavigate();
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
        <h1>Users</h1>
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
        <button type="submit">Search</button>
      </form>
      {users.isError && (
        <Notice kind="error">{errorMessage(users.error)}</Notice>
      )}
      {users.isPending ? (
        <p>Loading…</p>
      ) : users.data && users.data.items.length === 0 ? (
        <p>No users found.</p>
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
                <td data-label="Name">{u.displayName}</td>
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
        <div
          className="toolbar"
          style={{ marginTop: '1rem', alignItems: 'center' }}
        >
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages} · {users.data.total} accounts
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
  if (!user.data) return <p>Loading…</p>;
  // Keyed by id so a refetch after saving keeps the confirmation message.
  return <UserForm key={user.data.id} user={user.data} />;
}

function UserForm({ user }: { user: User }) {
  const client = useQueryClient();
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
      <p>
        <Link to="/users">← Users</Link>
      </p>
      <div className="page-header">
        <h1>{user.displayName}</h1>
        <StatusBadge status={user.status} />
      </div>
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
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <form className="card" onSubmit={submit}>
        <div className="grid-2">
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              Roles
            </legend>
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
                {ROLE_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <div>
            <div className="field">
              <label htmlFor="facility">
                Facility (which patients they can see)
              </label>
              <select
                id="facility"
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
            <label className="checkbox">
              <input
                type="checkbox"
                checked={active}
                disabled={isSelf}
                onChange={(e) => setActive(e.target.checked)}
              />
              Account active (turning this off signs the person out everywhere)
            </label>
          </div>
        </div>
        <button className="primary" type="submit" disabled={save.isPending}>
          Save changes
        </button>
      </form>
      <div className="toolbar" style={{ marginTop: '1rem' }}>
        {user.status === 'LOCKED' && (
          <button onClick={() => unlock.mutate()} disabled={unlock.isPending}>
            Unlock account
          </button>
        )}
        {!isSelf && (
          <button onClick={() => reset.mutate()} disabled={reset.isPending}>
            Reset password
          </button>
        )}
      </div>
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
      <p>
        <Link to="/users">← Users</Link>
      </p>
      <h1>Add staff user</h1>
      <p className="muted">
        Patients create their own accounts in the mobile app.
      </p>
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
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={{ fontWeight: 600 }}>Roles</legend>
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
              {ROLE_LABELS[r]}
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
