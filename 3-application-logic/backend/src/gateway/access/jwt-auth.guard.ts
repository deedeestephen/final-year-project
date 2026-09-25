import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../services/auth/auth.service';
import {
  ALLOW_PASSWORD_CHANGE_PENDING,
  IS_PUBLIC,
  type AuthenticatedRequest,
} from './access.decorators';

/**
 * Global authentication guard: every route requires a valid access token
 * unless marked @Public(). Registered as APP_GUARD, so new routes are
 * protected by default (API gateway: unauthenticated requests never reach
 * application logic).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets))
      return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    const match =
      typeof header === 'string'
        ? /^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(header)
        : null;
    if (!match) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }

    const user = await this.auth.authenticate(match[1]);
    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(
        ALLOW_PASSWORD_CHANGE_PENDING,
        targets,
      )
    ) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your temporary password before continuing',
      });
    }
    req.user = user;
    return true;
  }
}
