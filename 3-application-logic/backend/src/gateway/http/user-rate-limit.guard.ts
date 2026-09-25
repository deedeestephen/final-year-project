import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  InjectThrottlerStorage,
  ThrottlerException,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import type { AuthenticatedUser } from '../access/access.decorators';

export const USER_THROTTLER = 'user';

/**
 * Per-account rate limit, applied after authentication so it is keyed by the
 * verified user id (not the network address): one busy clinic sharing an
 * internet connection is not limited as a single client, and one account
 * cannot overload the system. Counts live in the shared throttler storage
 * (Redis when configured), so the limit holds across all API instances.
 */
@Injectable()
export class UserRateLimitGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return true; // public routes are covered by the address limit

    const { ttlMs, userLimit } = this.config.rateLimit;
    const record = await this.storage.increment(
      user.id,
      ttlMs,
      userLimit,
      ttlMs, // once over the limit, wait out the window (library default)
      USER_THROTTLER,
    );
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('X-RateLimit-Limit', String(userLimit));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, userLimit - record.totalHits)),
    );
    if (record.isBlocked || record.totalHits > userLimit) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, record.timeToBlockExpire || record.timeToExpire)),
      );
      throw new ThrottlerException();
    }
    return true;
  }
}
