import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  ALLOW_PASSWORD_CHANGE_PENDING,
  AUTH_RATE_LIMITED,
  IS_PUBLIC,
  REQUIRED_PERMISSIONS,
} from './access.decorators';
import {
  ROLE_PERMISSIONS,
  ROLES,
  type PermissionCode,
  type RoleName,
} from './permissions';

/*
 * Access matrix (Phase 15 security review): every API route with the rule
 * that protects it, read from the code itself. The review rules below fail
 * the quality gate when a route is public, open to every signed-in user, or
 * reachable by a role that should not reach it, without that being a
 * deliberate, listed decision.
 */

export type AccessKind = 'public' | 'signed-in' | 'permission';

export interface RouteAccess {
  method: string;
  path: string;
  access: AccessKind;
  permissions: PermissionCode[];
  /** Roles that can call it with the default permissions (admins can edit these). */
  defaultRoles: RoleName[];
  passwordChangePending: boolean;
  authRateLimited: boolean;
}

const API_PREFIX = '/api/v1';

/** Routes that may be called without signing in. */
export const PUBLIC_ROUTES = new Set([
  'GET /api/v1/health',
  'GET /api/v1/health/ready',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
]);

/** Routes every signed-in account may call: they only touch the caller's own session or profile. */
export const SIGNED_IN_ROUTES = new Set([
  'GET /api/v1/users/me',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/change-password',
]);

function joinPath(...parts: string[]): string {
  const path = parts
    .flatMap((p) => p.split('/'))
    .filter((p) => p.length > 0)
    .join('/');
  return `/${path}`;
}

function methodName(m: RequestMethod): string {
  return RequestMethod[m];
}

/** Reads every route and its access rule from the running (not listening) app. */
export function collectRoutes(app: INestApplication): RouteAccess[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const routes: RouteAccess[] = [];

  for (const wrapper of discovery.getControllers()) {
    const metatype = wrapper.metatype as
      (abstract new (...args: never[]) => unknown) | null;
    const instance = wrapper.instance as object | null;
    if (!metatype || !instance) continue;
    const classPaths = [
      Reflect.getMetadata(PATH_METADATA, metatype) as string | string[],
    ].flat();
    const proto = Object.getPrototypeOf(instance) as object;
    for (const name of scanner.getAllMethodNames(proto)) {
      const handler = (proto as Record<string, unknown>)[name] as (
        ...args: never[]
      ) => unknown;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
        RequestMethod | undefined;
      if (requestMethod === undefined) continue;
      const handlerPaths = [
        Reflect.getMetadata(PATH_METADATA, handler) as string | string[],
      ].flat();
      const targets = [handler, metatype] as const;
      const isPublic =
        reflector.getAllAndOverride<boolean>(IS_PUBLIC, [...targets]) ?? false;
      const declared: PermissionCode[] =
        reflector.getAllAndMerge<PermissionCode[]>(REQUIRED_PERMISSIONS, [
          ...targets,
        ]) ?? [];
      const permissions: PermissionCode[] = [...new Set(declared)].sort();
      const access: AccessKind = isPublic
        ? 'public'
        : permissions.length > 0
          ? 'permission'
          : 'signed-in';
      const defaultRoles: RoleName[] =
        access === 'permission'
          ? ROLES.filter((r) =>
              permissions.every((p) => ROLE_PERMISSIONS[r].includes(p)),
            )
          : access === 'signed-in'
            ? [...ROLES]
            : [];
      for (const cp of classPaths) {
        for (const hp of handlerPaths) {
          routes.push({
            method: methodName(requestMethod),
            path: joinPath(API_PREFIX, cp ?? '', hp ?? ''),
            access,
            permissions,
            defaultRoles,
            passwordChangePending:
              reflector.getAllAndOverride<boolean>(
                ALLOW_PASSWORD_CHANGE_PENDING,
                [...targets],
              ) ?? false,
            authRateLimited:
              reflector.getAllAndOverride<boolean>(AUTH_RATE_LIMITED, [
                ...targets,
              ]) ?? false,
          });
        }
      }
    }
  }
  return routes.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}

const key = (r: RouteAccess) => `${r.method} ${r.path}`;

/** Areas where only administrators belong (no routine access to clinical data). */
const ADMIN_AREAS = ['/api/v1/admin', '/api/v1/fhir', '/api/v1/users'];
/** Areas that hold clinical data: never administrators or patients by default. */
const CLINICAL_AREAS = [
  '/api/v1/patients/:',
  '/api/v1/clinical-records',
  '/api/v1/imaging',
  '/api/v1/histopathology',
  '/api/v1/ai-jobs',
  '/api/v1/explanations',
  '/api/v1/sync',
];

/** Everything the review rules object to; empty means the matrix passes. */
export function accessProblems(routes: RouteAccess[]): string[] {
  const problems: string[] = [];
  const seen = new Set(routes.map(key));
  for (const r of routes) {
    const k = key(r);
    if (r.access === 'public' && !PUBLIC_ROUTES.has(k)) {
      problems.push(`${k} is public but not in PUBLIC_ROUTES`);
    }
    if (r.access === 'signed-in' && !SIGNED_IN_ROUTES.has(k)) {
      problems.push(
        `${k} is open to every signed-in account; give it a permission or list it in SIGNED_IN_ROUTES`,
      );
    }
    if (
      ADMIN_AREAS.some((a) => r.path.startsWith(a)) &&
      !SIGNED_IN_ROUTES.has(k) &&
      r.defaultRoles.join() !== 'ADMIN'
    ) {
      problems.push(
        `${k} is an administration route but is open to ${r.defaultRoles.join(', ') || 'nobody'}`,
      );
    }
    if (
      CLINICAL_AREAS.some((a) => r.path.startsWith(a)) &&
      (r.defaultRoles.includes('ADMIN') || r.defaultRoles.includes('PATIENT'))
    ) {
      problems.push(
        `${k} holds clinical data but is open to ${r.defaultRoles.join(', ')}`,
      );
    }
    if (
      r.access === 'permission' &&
      r.defaultRoles.includes('PATIENT') &&
      !/\/me(\/|$)/.test(r.path) &&
      !r.path.startsWith('/api/v1/notifications')
    ) {
      problems.push(
        `${k} is open to patients but is not one of their own ("me") routes`,
      );
    }
    if (r.access === 'permission' && r.defaultRoles.length === 0) {
      problems.push(`${k} needs permissions that no role has by default`);
    }
  }
  for (const k of [...PUBLIC_ROUTES, ...SIGNED_IN_ROUTES]) {
    if (!seen.has(k)) problems.push(`${k} is listed but no longer exists`);
  }
  return problems;
}

/** The matrix as a Markdown table for docs/access-matrix.md. */
export function toMarkdown(routes: RouteAccess[]): string {
  const rows = routes.map((r) => {
    const rule =
      r.access === 'public'
        ? 'public'
        : r.access === 'signed-in'
          ? 'any signed-in account'
          : r.permissions.map((p) => `\`${p}\``).join(' + ');
    const notes = [
      r.authRateLimited ? 'stricter sign-in rate limit' : '',
      r.passwordChangePending ? 'allowed before the first password change' : '',
    ]
      .filter(Boolean)
      .join('; ');
    return `| ${r.method} | \`${r.path}\` | ${rule} | ${r.defaultRoles.join(', ') || '–'} | ${notes} |`;
  });
  return [
    '# Access matrix',
    '',
    'Generated from the code (`npm run access:matrix`); the quality gate fails if it is out of date or breaks a review rule',
    '(`src/gateway/access/access-matrix.ts`). "Default roles" use the default permissions; administrators can change a',
    "role's permissions, within the locks described in [security.md](security.md). Every route not marked public needs a",
    'valid access token, and the account must be active.',
    '',
    `${routes.length} routes.`,
    '',
    '| Method | Path | Rule | Default roles | Notes |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
