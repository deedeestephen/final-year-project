import {
  PUBLIC_ROUTES,
  SIGNED_IN_ROUTES,
  accessProblems,
  toMarkdown,
  type RouteAccess,
} from './access-matrix';

const route = (over: Partial<RouteAccess>): RouteAccess => ({
  method: 'GET',
  path: '/api/v1/patients/:id',
  access: 'permission',
  permissions: ['patient:read'],
  defaultRoles: ['CLINICIAN', 'PATHOLOGIST'],
  passwordChangePending: false,
  authRateLimited: false,
  ...over,
});

/** The listed routes themselves, so "listed but no longer exists" stays quiet. */
const listed: RouteAccess[] = [
  ...[...PUBLIC_ROUTES].map((k) =>
    route({
      method: k.split(' ')[0],
      path: k.split(' ')[1],
      access: 'public',
      permissions: [],
      defaultRoles: [],
    }),
  ),
  ...[...SIGNED_IN_ROUTES].map((k) =>
    route({
      method: k.split(' ')[0],
      path: k.split(' ')[1],
      access: 'signed-in',
      permissions: [],
      defaultRoles: ['PATIENT', 'CLINICIAN', 'PATHOLOGIST', 'ADMIN'],
    }),
  ),
];

describe('access review rules', () => {
  it('accepts a correctly protected set of routes', () => {
    expect(accessProblems([...listed, route({})])).toEqual([]);
  });

  it('flags a new public route that is not on the list', () => {
    expect(
      accessProblems([
        ...listed,
        route({
          path: '/api/v1/patients/export',
          access: 'public',
          permissions: [],
          defaultRoles: [],
        }),
      ]),
    ).toEqual([
      'GET /api/v1/patients/export is public but not in PUBLIC_ROUTES',
    ]);
  });

  it('flags a route that forgot its permission', () => {
    const problems = accessProblems([
      ...listed,
      route({
        access: 'signed-in',
        permissions: [],
        defaultRoles: ['PATIENT', 'CLINICIAN', 'PATHOLOGIST', 'ADMIN'],
      }),
    ]);
    expect(problems).toContain(
      'GET /api/v1/patients/:id is open to every signed-in account; give it a permission or list it in SIGNED_IN_ROUTES',
    );
    expect(problems).toContain(
      'GET /api/v1/patients/:id holds clinical data but is open to PATIENT, CLINICIAN, PATHOLOGIST, ADMIN',
    );
  });

  it('keeps administration routes for administrators only', () => {
    expect(
      accessProblems([
        ...listed,
        route({
          path: '/api/v1/admin/roles',
          defaultRoles: ['CLINICIAN', 'ADMIN'],
        }),
      ]),
    ).toEqual([
      'GET /api/v1/admin/roles is an administration route but is open to CLINICIAN, ADMIN',
    ]);
  });

  it('keeps patients to their own "me" routes', () => {
    expect(
      accessProblems([
        ...listed,
        route({ path: '/api/v1/reports', defaultRoles: ['PATIENT'] }),
      ]),
    ).toEqual([
      'GET /api/v1/reports is open to patients but is not one of their own ("me") routes',
    ]);
  });

  it('notices a listed route that was removed', () => {
    const withoutLogin = listed.filter((r) => r.path !== '/api/v1/auth/login');
    expect(accessProblems(withoutLogin)).toEqual([
      'POST /api/v1/auth/login is listed but no longer exists',
    ]);
  });

  it('writes one table row per route', () => {
    const md = toMarkdown([route({})]);
    expect(md).toContain(
      '| GET | `/api/v1/patients/:id` | `patient:read` | CLINICIAN, PATHOLOGIST |  |',
    );
    expect(md).toContain('1 routes.');
  });
});
