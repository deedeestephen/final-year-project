import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../services/audit/audit.service';
import {
  IS_PUBLIC,
  REQUIRED_PERMISSIONS,
  clientOf,
  type AuthenticatedRequest,
} from './access.decorators';
import type { PermissionCode } from './permissions';

/**
 * Role-based access control (FR-01): checks the permissions declared with
 * @RequirePermissions against those granted to the user's roles. Denials are
 * audited. Hiding buttons in the app is never relied on for security.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets))
      return true;

    const required =
      this.reflector.getAllAndMerge<PermissionCode[]>(
        REQUIRED_PERMISSIONS,
        targets,
      ) ?? [];
    if (required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    const missing = required.filter((p) => !user?.permissions.includes(p));
    if (missing.length === 0) return true;

    await this.audit.record({
      action: 'access.denied',
      entityType: 'route',
      entityId: `${req.method} ${req.route ? (req.route as { path: string }).path : req.path}`,
      outcome: 'DENIED',
      actorUserId: user?.id ?? null,
      actorRole: user?.roles.join(',') ?? null,
      requestId: req.id ?? null,
      ip: req.ip ?? null,
      client: clientOf(req.headers['x-client']),
      details: { missing },
    });
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action',
    });
  }
}
