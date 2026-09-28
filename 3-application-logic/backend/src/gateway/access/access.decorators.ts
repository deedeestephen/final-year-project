import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { PermissionCode, RoleName } from './permissions';

/** The user attached to a request by JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  roles: RoleName[];
  permissions: PermissionCode[];
  facilityId: string | null;
  mustChangePassword: boolean;
  /** Login session (refresh-token family) of the access token used. */
  familyId: string;
}

export type AuthenticatedRequest = Request & {
  id?: string;
  user?: AuthenticatedUser;
};

export const IS_PUBLIC = 'access:isPublic';
export const REQUIRED_PERMISSIONS = 'access:requiredPermissions';
export const ALLOW_PASSWORD_CHANGE_PENDING =
  'access:allowPasswordChangePending';
export const AUTH_RATE_LIMITED = 'access:authRateLimited';

/** Route needs no authentication (default is deny). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route requires all listed permissions (enforced server-side by PermissionsGuard). */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** Route stays usable while the user must still change a temporary password. */
export const AllowWhenPasswordChangeRequired = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING, true);

/** Applies the stricter authentication rate limit to this route. */
export const AuthRateLimited = () => SetMetadata(AUTH_RATE_LIMITED, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user)
      throw new Error('CurrentUser used on a route without authentication');
    return req.user;
  },
);

/** Which app sent the request (the `X-Client` header), for activity reports. */
export type ClientApp = 'mobile' | 'web';

export interface RequestContext {
  requestId: string | null;
  ip: string | null;
  /** From the `X-Client` header; only known values, never free text. */
  client?: ClientApp | null;
}

/** Reads `X-Client`, accepting only the two known app names. */
export function clientOf(header: unknown): ClientApp | null {
  if (typeof header !== 'string') return null;
  const value = header.trim().toLowerCase();
  return value === 'mobile' || value === 'web' ? value : null;
}

export const Ctx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return {
      requestId: req.id ?? null,
      ip: req.ip ?? null,
      client: clientOf(req.headers['x-client']),
    };
  },
);
