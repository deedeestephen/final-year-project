import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/** Null when REDIS_URL is not set (single instance: in-memory counters). */
export const SHARED_THROTTLER_STORAGE = Symbol('SHARED_THROTTLER_STORAGE');

/**
 * Owns the Redis rate-limit store as a provider, so Nest closes the
 * connection on shutdown.
 */
@Global()
@Module({
  providers: [
    {
      provide: SHARED_THROTTLER_STORAGE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.redisUrl ? new RedisThrottlerStorage(config.redisUrl) : null,
    },
  ],
  exports: [SHARED_THROTTLER_STORAGE],
})
export class RateLimitModule {}
