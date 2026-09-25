import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';
import { AUTH_RATE_LIMITED } from '../access/access.decorators';

export const AUTH_THROTTLER = 'auth';

/**
 * Two limits: `default` for every route, and a stricter `auth` limit that
 * applies only to routes marked @AuthRateLimited() (login, register, refresh,
 * password reset) to slow down credential stuffing.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(
    request: ThrottlerRequest,
  ): Promise<boolean> {
    if (request.throttler.name === AUTH_THROTTLER) {
      const marked = this.reflector.getAllAndOverride<boolean>(
        AUTH_RATE_LIMITED,
        [request.context.getHandler(), request.context.getClass()],
      );
      if (!marked) return true;
    }
    return super.handleRequest(request);
  }
}
